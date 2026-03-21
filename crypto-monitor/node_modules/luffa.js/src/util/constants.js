/**
 * Constants for Luffa API
 */

// Message types
export const MESSAGE_TYPE_PRIVATE = 0;
export const MESSAGE_TYPE_GROUP = 1;

// Group message types
export const GROUP_MESSAGE_TYPE_TEXT = 1;
export const GROUP_MESSAGE_TYPE_BUTTONS = 2;

// Button types
export const BUTTON_TYPE_DEFAULT = "default";
export const BUTTON_TYPE_DESTRUCTIVE = "destructive";

// Visibility flags
export const VISIBILITY_HIDDEN = "1";
export const VISIBILITY_VISIBLE = "0";

// Dismiss behavior
export const DISMISS_TYPE_SELECT = "select";
export const DISMISS_TYPE_DISMISS = "dismiss";

// API endpoints
export const API_BASE_URL = "https://apibot.luffa.im";
export const ENDPOINT_RECEIVE = "/robot/receive";
export const ENDPOINT_SEND = "/robot/send";
export const ENDPOINT_SEND_GROUP = "/robot/sendGroup";

// Default poll interval (milliseconds)
export const DEFAULT_POLL_INTERVAL = 1000;

// Default minimum Node version
export const MIN_NODE_VERSION = "18.0.0";
