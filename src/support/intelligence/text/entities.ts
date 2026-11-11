export function extractEntities(text: string): Record<string, string> {
  const entities: Record<string, string> = {};
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  if (email) entities.email = email[0].toLowerCase();

  const blood = text.match(
    /\b(AB|A|B|O)\s*(\+|plus|-|minus|positive|negative)(?=\s|$|[^a-z0-9])/i,
  );
  if (blood) {
    const sign = blood[2].toLowerCase();
    const compact =
      sign === 'plus' || sign === 'positive'
        ? '+'
        : sign === 'minus' || sign === 'negative'
          ? '-'
          : sign;
    entities.bloodType = `${blood[1].toUpperCase()}${compact}`;
  }
  return entities;
}
