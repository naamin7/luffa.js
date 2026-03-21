import { Alchemy, Network } from "alchemy-sdk";

const SPAM_BALANCE_THRESHOLD = 0.0001;

let alchemyClient: Alchemy | null = null;

function getClient(): Alchemy {
  if (alchemyClient) return alchemyClient;

  alchemyClient = new Alchemy({
    apiKey: process.env.ALCHEMY_API_KEY,
    network: Network.ETH_MAINNET,
  });

  return alchemyClient;
}

export interface Token {
  contract_address: string;
  token_name: string;
  symbol: string;
  balance: number;
}

export async function getTokens(address: string): Promise<Token[]> {
  const alchemy = getClient();
  const response = await alchemy.core.getTokenBalances(address);
  const tokens: Token[] = [];

  for (const entry of response.tokenBalances) {
    const rawBalance = parseInt(entry.tokenBalance || "0", 16);
    if (rawBalance === 0) continue;

    const metadata = await alchemy.core.getTokenMetadata(
      entry.contractAddress
    );

    if (!metadata.name || !metadata.symbol || metadata.decimals === null) {
      continue;
    }

    const balance = rawBalance / Math.pow(10, metadata.decimals);

    if (balance < SPAM_BALANCE_THRESHOLD) continue;

    tokens.push({
      contract_address: entry.contractAddress,
      token_name: metadata.name,
      symbol: metadata.symbol,
      balance,
    });
  }

  return tokens;
}
