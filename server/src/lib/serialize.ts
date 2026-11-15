export const jsonList = (value: string | null | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

export const toJsonList = (value: unknown): string =>
  JSON.stringify(Array.isArray(value) ? value.filter((v) => typeof v === "string") : []);
