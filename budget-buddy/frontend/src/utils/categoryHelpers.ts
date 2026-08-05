export const matchCategoryIcon = (name: string): string => {
  const n = name.trim().toLowerCase();

  // ── Transport / Travel ────────────────────────────────────────────────────
  if (/flight|fly|airline|airport|plane|aviation|indigo|airasia|air india|vistara|spicejet/i.test(n)) return '✈️';
  if (/uber|ola|rapido|blabla|cab|taxi|auto|rickshaw|tuk/i.test(n)) return '🛺';
  if (/metro|local train|suburban|railway|irctc|train|express|mail train/i.test(n)) return '🚇';
  if (/\bbus\b|volvo|ksrtc|msrtc|apsrtc|redbus|state bus|college bus/i.test(n)) return '🚌';
  if (/petrol|diesel|fuel|gas station|hp pump|iocl|bpcl|filling station/i.test(n)) return '⛽';
  if (/bike|motorcycle|scooter|activa|scooty|royal enfield|yamaha|honda|service center/i.test(n)) return '🏍️';
  if (/\bcar\b|parking|toll|highway|expressway|four wheeler|swift|alto|innova/i.test(n)) return '🚗';
  if (/\btravel\b|trip|tour|holiday|vacation|tourism|journey|pilgrimage|trekking|hiking/i.test(n)) return '🧳';
  if (/hotel|resort|airbnb|oyo|goibibo|makemytrip|booking|check.?in|stay|hostel|lodge/i.test(n)) return '🏨';

  // ── Food & Dining ─────────────────────────────────────────────────────────
  if (/swiggy|zomato|dunzo|food.?panda|blinkit|zepto|instamart/i.test(n)) return '🛵';
  if (/pizza|domino|pizza hut|margherita/i.test(n)) return '🍕';
  if (/burger|mc.?donald|burger king|kfc|whopper/i.test(n)) return '🍔';
  if (/biryani|biriyani|thali|veg meal|non.?veg/i.test(n)) return '🍛';
  if (/coffee|starbucks|ccd|costa|barista|cappuccino|latte|espresso/i.test(n)) return '☕';
  if (/\btea\b|chai|masala tea|cutting chai|ginger tea/i.test(n)) return '🍵';
  if (/juice|smoothie|milkshake|cold drink|pepsi|coke|sprite|lassi|buttermilk/i.test(n)) return '🥤';
  if (/ice cream|gelato|kulfi|dessert|cake|pastry|sweet|mithai|halwa/i.test(n)) return '🍦';
  if (/chicken|mutton|fish|seafood|egg|prawns|crab/i.test(n)) return '🍗';
  if (/bread|sandwich|subway|pav|vada pav|pav bhaji|dosa|idli|sambar|upma/i.test(n)) return '🥪';
  if (/chocolate|candy|toffee|kitkat|dairy milk/i.test(n)) return '🍫';
  if (/snack|chips|biscuit|cookie|namkeen|maggi|noodle|instant/i.test(n)) return '🍟';
  if (/restaurant|dining|dine|eat|lunch|dinner|breakfast|brunch|mess|dhaba|canteen|cafeteria|tiffin/i.test(n)) return '🍽️';
  if (/food|meal|khana/i.test(n)) return '🍔';

  // ── Shopping ──────────────────────────────────────────────────────────────
  if (/amazon|flipkart|myntra|meesho|ajio|nykaa/i.test(n)) return '🛒';
  if (/clothes|dress|shirt|pant|jeans|kurti|saree|top|tshirt|t-shirt|ethnic|churidar/i.test(n)) return '👗';
  if (/shoes|footwear|sandal|slipper|chappal|sneaker|boot|loafer|nike|adidas|puma/i.test(n)) return '👟';
  if (/grocery|kirana|vegetables|fruits|dairy|milk|supermarket|d-mart|big bazaar|reliance fresh/i.test(n)) return '🥬';
  if (/mobile|phone|iphone|samsung|oneplus|realme|oppo|vivo|redmi|gadget/i.test(n)) return '📱';
  if (/laptop|computer|macbook|dell|hp|lenovo|asus|tablet|ipad/i.test(n)) return '💻';
  if (/watch|jewellery|jewelry|ring|necklace|earring|bracelet/i.test(n)) return '💍';
  if (/bag|purse|backpack|wallet|handbag/i.test(n)) return '👜';
  if (/furniture|sofa|bed|table|chair|almirah|wardrobe|mattress/i.test(n)) return '🛋️';
  if (/shopping|purchase|buy|mall|market|outlet|store/i.test(n)) return '🛍️';

  // ── Rent & Housing ────────────────────────────────────────────────────────
  if (/\brent\b|pg\b|flat|apartment|1bhk|2bhk|accommodation|housing/i.test(n)) return '🏠';
  if (/maintenance|society|repair|plumber|electrician|carpenter|painting|renovation/i.test(n)) return '🔧';
  if (/electricity|electric bill|power|bescom|tneb|mseb|bijli/i.test(n)) return '💡';
  if (/water bill|municipal|water charge/i.test(n)) return '💧';
  if (/\bgas\b|lpg|cylinder|indane|bharat gas|hp gas|cooking gas/i.test(n)) return '🔥';
  if (/wifi|broadband|internet|jio fiber|airtel fiber|bsnl|act fiber/i.test(n)) return '📡';
  if (/recharge|prepaid|postpaid|top.?up|jio|airtel|vodafone|vi\b/i.test(n)) return '📶';
  if (/ott|netflix|prime video|hotstar|disney|zee5|sonyliv|subscription/i.test(n)) return '📺';

  // ── Entertainment ─────────────────────────────────────────────────────────
  if (/movie|cinema|pvr|inox|cinepolis|bookmyshow|film|theatre/i.test(n)) return '🎬';
  if (/spotify|apple music|concert|live show/i.test(n)) return '🎵';
  if (/gaming|steam|pubg|bgmi|free fire|valorant|ps4|ps5|xbox/i.test(n)) return '🎮';
  if (/party|nightclub|bar|pub|alcohol|beer|wine|whisky|cocktail/i.test(n)) return '🎉';
  if (/entertainment/i.test(n)) return '🎬';

  // ── Health & Medical ──────────────────────────────────────────────────────
  if (/hospital|clinic|apollo|fortis|max hospital|aiims|medanta/i.test(n)) return '🏥';
  if (/doctor|physician|specialist|consultation|opd|checkup/i.test(n)) return '👨‍⚕️';
  if (/medicine|tablet|capsule|pharmacy|chemist|medplus|netmeds|1mg|pharmeasy/i.test(n)) return '💊';
  if (/dental|dentist|tooth/i.test(n)) return '🦷';
  if (/eye|optical|glasses|spectacle/i.test(n)) return '👓';
  if (/lab test|blood test|diagnostic|pathology|x.?ray|scan|mri/i.test(n)) return '🔬';
  if (/health|medical|mediclaim|health cover/i.test(n)) return '🏥';

  // ── Fitness ───────────────────────────────────────────────────────────────
  if (/gym|fitness|cult.?fit|crossfit|zumba|workout|exercise/i.test(n)) return '🏋️';
  if (/yoga|meditation|pilates|wellness|spa|massage/i.test(n)) return '🧘';
  if (/cricket|football|basketball|badminton|tennis|swimming|cycling|sports/i.test(n)) return '⚽';

  // ── Education ─────────────────────────────────────────────────────────────
  if (/school|college|university|tuition|coaching|course|fees|exam|admission/i.test(n)) return '🎓';
  if (/\bbook\b|textbook|study|library/i.test(n)) return '📚';

  // ── Finance & Banking ─────────────────────────────────────────────────────
  if (/\bloan\b|emi|credit card|repayment|debt|borrow/i.test(n)) return '💳';
  if (/\bbank\b|atm|fixed deposit|mutual fund|sip|investment|stock|share/i.test(n)) return '🏦';
  if (/insurance|lic|term plan|policy|premium/i.test(n)) return '🛡️';
  if (/salary|income|earning|freelance|paycheck|stipend|bonus|cashback|refund/i.test(n)) return '💰';
  if (/\btax\b|gst|tds|income tax|itr/i.test(n)) return '📋';

  // ── Gifts & Celebrations ──────────────────────────────────────────────────
  if (/\bgift\b|present|hamper|birthday gift/i.test(n)) return '🎁';
  if (/wedding|marriage|engagement|reception|anniversary|ceremony/i.test(n)) return '💒';
  if (/birthday|bday|celebration|festival|diwali|holi|eid|christmas/i.test(n)) return '🎂';
  if (/flower|bouquet|rose|decoration/i.test(n)) return '💐';

  // ── Pets ──────────────────────────────────────────────────────────────────
  if (/\bdog\b|\bcat\b|puppy|kitten|rabbit|bird|fish|hamster|vet|pet food/i.test(n)) return '🐾';

  // ── Kids & Baby ───────────────────────────────────────────────────────────
  if (/baby|infant|diaper|pampers|toy|kids|child|tiffin box/i.test(n)) return '🧸';

  // ── Beauty & Personal Care ───────────────────────────────────────────────
  if (/salon|haircut|parlour|hair|waxing|threading|facial|pedicure|manicure/i.test(n)) return '💇';
  if (/cosmetic|makeup|lipstick|foundation|serum|face wash|moisturizer|skincare/i.test(n)) return '💄';

  // ── Kitchen & Home ───────────────────────────────────────────────────────
  if (/kitchen|utensil|cooker|pressure cooker|mixer|grinder|microwave|oven|fridge/i.test(n)) return '🍳';
  if (/cleaning|detergent|surf|ariel|vim|mop|broom|pocha/i.test(n)) return '🧹';

  // ── Others / Fallback ───────────────────────────────────────────────────
  return '🏷️';
};

export const matchCategoryColor = (name: string): string => {
  const n = name.trim().toLowerCase();
  if (/food|dine|restaurant|cafe|eat|lunch|dinner|breakfast|snack|cookie|burger|pizza|sandwich|tea|coffee|starbucks|juice/i.test(n)) return '#F59E0B';
  if (/travel|flight|train|bus|cab|taxi|uber|ola|auto|ride|fare|fuel|petrol|diesel|gas|ticket/i.test(n)) return '#06B6D4';
  if (/shop|mall|clothes|dress|shoe|pant|grocery|groceries|supermarket|market|milk|buy/i.test(n)) return '#8B5CF6';
  if (/rent|home|flat|house|room|pg|apartment|stay|hotel|hostel/i.test(n)) return '#10B981';
  if (/entertainment|movie|show|netflix|prime|spotify|cinema|theatre|music|song|game|play|subscription/i.test(n)) return '#EF4444';
  if (/gym|workout|health|fitness|sport|run|exercise|meditation/i.test(n)) return '#EC4899';
  if (/bill|electricity|water|utility|power|wifi|internet|mobile|recharge|phone/i.test(n)) return '#3B82F6';
  if (/salary|income|bonus|cashback|refund|interest|job/i.test(n)) return '#10B981';
  if (/doctor|hospital|clinic|medicine|medical|health|pill|dentist|eye|physio/i.test(n)) return '#F43F5E';
  if (/gift|present|birthday|anniversary|celebration/i.test(n)) return '#D946EF';
  if (/book|education|school|college|course|fee|fees|study|stationary/i.test(n)) return '#6366F1';
  if (/pet|dog|cat|vet|animal/i.test(n)) return '#F97316';
  if (/loan|debt|bank|emi|credit/i.test(n)) return '#14B8A6';
  return '#6B7280';
};
