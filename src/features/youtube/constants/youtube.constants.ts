export const YOUTUBE_ACTIONS = {
  OPEN_VIDEO: "youtube:open_video",
  RESOLVE_VIDEO: "youtube:resolve_video",
} as const;

export const YOUTUBE_STORAGE_KEYS = {
  RECENTS: "local:youtube:recents",
  PLAYER: "local:youtube:player",
} as const;

export const YOUTUBE_URLS = {
  SCHEME: "https://",
  WATCH: "https://www.youtube.com/watch?v=",
  EMBED: "https://www.youtube-nocookie.com/embed/",
  THUMBNAIL: "https://i.ytimg.com/vi/",
  OEMBED: "https://www.youtube.com/oembed",
} as const;

export const YOUTUBE_CONFIG = {
  RECENTS_LIMIT: 12,

  PLAYER_WIDTH: 420,
  PLAYER_MIN_WIDTH: 260,
  PLAYER_MIN_HEIGHT: 180,
  PLAYER_EDGE_GAP: 18,
  PLAYER_DEFAULT_VIEWPORT: { width: 1280, height: 800 },
  REQUEST_TIMEOUT_MS: 8_000,

  ID_PATTERN: /^[A-Za-z0-9_-]{11}$/,
} as const;
