export const PERFECT_API_ENDPOINTS = {
	task: "https://yce-api-01.makeupar.com/s2s/v2.0/task/makeup-vto",
	file: "https://yce-api-01.makeupar.com/s2s/v2.0/file/makeup-vto",
} as const;

export const PERFECT_ANALYZER_CONFIG = {
	sourceContentType: "image/jpeg",
	sourceFileName: "selfie.jpg",
	apiVersion: "1.0",
	polling: {
		intervalMs: 2000,
		maxAttempts: 10,
	},
} as const;

export const DEFAULT_MAKEUP_EFFECTS = [
	{
		category: "blush",
		pattern: { name: "1color2" },
		palettes: [{ color: "#3C1616", texture: "matte", colorIntensity: 50 }],
	},
] as const;