# Expense Assistant Domain Rules

## 1. Categorization Taxonomy
Assign every transaction to one of these standardized buckets:
- **Food**: Restaurants, groceries, tea/coffee, snacks, food delivery.
- **Transport**: Fuel/petrol/diesel, metro, taxi, cab, bus, train, parking.
- **Shopping**: Clothing, shoes, electronics, personal accessories.
- **Bills**: Electricity, Wi-Fi, water, mobile recharge, gas, rent.
- **Entertainment**: Movies, games, OTT subscriptions (Netflix, Spotify).
- **Health**: Medicines, doctor visits, hospital bills, gym/fitness.
- **Education**: Books, courses, tuition, tutorials.
- **Other**: Any expense not cleanly falling into the categories above.

## 2. Multi-Tenant Isolation
- Never rely on user input for `user_id`.
- The `user_id` must ALWAYS be obtained from `config["configurable"]["user_id"]` derived from the verified JWT token.
- No user can access, see, edit, or delete another user's expenses.
