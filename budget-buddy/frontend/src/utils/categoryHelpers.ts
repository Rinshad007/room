export const matchCategoryIcon = (name: string): string => {
  const n = name.trim().toLowerCase();
  if (/food|dine|restaurant|cafe|eat|lunch|dinner|breakfast|snack|cookie|burger|pizza|sandwich|tea|coffee|starbucks|juice/i.test(n)) return '🍔';
  if (/travel|flight|train|bus|cab|taxi|uber|ola|auto|ride|fare|fuel|petrol|diesel|gas|ticket/i.test(n)) return '✈️';
  if (/shop|mall|clothes|dress|shoe|shift|pant|grocery|groceries|supermarket|market|milk|buy/i.test(n)) return '🛍️';
  if (/rent|home|flat|house|room|pg|apartment|stay|hotel|hostel/i.test(n)) return '🏠';
  if (/entertainment|movie|show|netflix|prime|spotify|cinema|theatre|music|song|game|play|subscription/i.test(n)) return '🎬';
  if (/gym|workout|health|fitness|sport|run|exercise|meditation/i.test(n)) return '🏋️';
  if (/bill|electricity|water|utility|power|wifi|internet|mobile|recharge|phone/i.test(n)) return '⚡';
  if (/salary|income|bonus|cashback|refund|interest|job/i.test(n)) return '💰';
  if (/doctor|hospital|clinic|medicine|medical|health|pill|dentist|eye|physio/i.test(n)) return '🏥';
  if (/gift|present|birthday|anniversary|celebration/i.test(n)) return '🎁';
  if (/book|education|school|college|course|fee|fees|study|stationary/i.test(n)) return '📚';
  if (/pet|dog|cat|vet|animal/i.test(n)) return '🐶';
  if (/loan|debt|bank|emi|credit/i.test(n)) return '🏦';
  return '🏷️';
};

export const matchCategoryColor = (name: string): string => {
  const n = name.trim().toLowerCase();
  if (/food|dine|restaurant|cafe|eat|lunch|dinner|breakfast|snack|cookie|burger|pizza|sandwich|tea|coffee|starbucks|juice/i.test(n)) return '#F59E0B'; // Amber
  if (/travel|flight|train|bus|cab|taxi|uber|ola|auto|ride|fare|fuel|petrol|diesel|gas|ticket/i.test(n)) return '#06B6D4'; // Cyan
  if (/shop|mall|clothes|dress|shoe|shift|pant|grocery|groceries|supermarket|market|milk|buy/i.test(n)) return '#8B5CF6'; // Purple
  if (/rent|home|flat|house|room|pg|apartment|stay|hotel|hostel/i.test(n)) return '#10B981'; // Green
  if (/entertainment|movie|show|netflix|prime|spotify|cinema|theatre|music|song|game|play|subscription/i.test(n)) return '#EF4444'; // Red
  if (/gym|workout|health|fitness|sport|run|exercise|meditation/i.test(n)) return '#EC4899'; // Pink
  if (/bill|electricity|water|utility|power|wifi|internet|mobile|recharge|phone/i.test(n)) return '#3B82F6'; // Blue
  if (/salary|income|bonus|cashback|refund|interest|job/i.test(n)) return '#10B981'; // Green
  if (/doctor|hospital|clinic|medicine|medical|health|pill|dentist|eye|physio/i.test(n)) return '#F43F5E'; // Rose
  if (/gift|present|birthday|anniversary|celebration/i.test(n)) return '#D946EF'; // Fuchsia
  if (/book|education|school|college|course|fee|fees|study|stationary/i.test(n)) return '#6366F1'; // Indigo
  if (/pet|dog|cat|vet|animal/i.test(n)) return '#F97316'; // Orange
  if (/loan|debt|bank|emi|credit/i.test(n)) return '#14B8A6'; // Teal
  return '#6B7280'; // Gray
};
