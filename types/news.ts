export type NewsCategory = "PC" | "Console" | "Industry" | "Reviews";
export type GameScale = "AAA" | "AA" | "Indie";

export interface SocialViewpoint {
  stance: string;
  detail: string;
}

export interface SocialPulse {
  sentiment: "Backlash" | "Divided" | "Hyped" | "Heated" | "Mixed";
  viralPlatforms: string[];
  summary: string;
  viewpoints: SocialViewpoint[];
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content?: string[];
  highlights?: string[];
  socialPulse?: SocialPulse;
  category: NewsCategory;
  gameTitle?: string;
  gameScale?: GameScale;
  fanbaseScore?: number;
  isUpcoming?: boolean;
  isRumor?: boolean;
  releaseWindow?: string;
  isControversy?: boolean;
  controversyAngle?: string;
  isTrending?: boolean;
  importance?: number;
  source: string;
  url: string;
  image: string;
  publishedAt: string;
}
