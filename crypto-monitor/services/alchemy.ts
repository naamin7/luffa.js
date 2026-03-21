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
  official_twitter?: string;
  telegram_group?: string;
  website?: string;
  aliases?: string[];
  coingecko_id?: string;
}

export async function getTokens(address: string): Promise<Token[]> {
  const alchemy = getClient();

  console.log(`Fetching token balances for: ${address}`);

  const response = await alchemy.core.getTokenBalances(address);

  console.log(
    `Alchemy returned ${response.tokenBalances.length} token entries`
  );

  const tokens: Token[] = [];

  for (const entry of response.tokenBalances) {
    const hexBalance = entry.tokenBalance || "0x0";

    // Use BigInt to handle large token balances without overflow
    const rawBalance = BigInt(hexBalance);
    if (rawBalance === 0n) {
      continue;
    }

    try {
      const metadata = await alchemy.core.getTokenMetadata(
        entry.contractAddress
      );

      if (
        !metadata.name ||
        !metadata.symbol ||
        metadata.decimals === null ||
        metadata.decimals === undefined
      ) {
        console.log(
          `Skipping ${entry.contractAddress}: missing metadata (name=${metadata.name}, symbol=${metadata.symbol}, decimals=${metadata.decimals})`
        );
        continue;
      }

      // Convert BigInt balance to a readable number
      const divisor = BigInt(10 ** metadata.decimals);
      const wholePart = rawBalance / divisor;
      const fractionalPart = rawBalance % divisor;
      const balance =
        Number(wholePart) +
        Number(fractionalPart) / Number(divisor);

      if (balance < SPAM_BALANCE_THRESHOLD) {
        console.log(
          `Filtered ${metadata.symbol}: balance ${balance} below threshold`
        );
        continue;
      }

      console.log(
        `Found token: ${metadata.symbol} (${metadata.name}) - balance: ${balance}`
      );

      tokens.push({
        contract_address: entry.contractAddress,
        token_name: metadata.name,
        symbol: metadata.symbol,
        balance,
      });
    } catch (err) {
      console.error(
        `Failed to fetch metadata for ${entry.contractAddress}:`,
        err
      );
      continue;
    }
  }

  console.log(
    `Final result: ${tokens.length} tokens after filtering`
  );

  return tokens;
}
