# Example asks

The client posts these as normal questions. The tool names are what the server exposes.

Prices are Toman and move. Every answer should include the torob.com link.

## Cheapest wireless headphones

"هدفون بی سیم زیر ۲ میلیون تومان"

`torob_suggest` if the wording is loose, then `find_best_value` with `budget_toman: 2000000`. The card price is the cheapest shop, so follow the top pick with `product_sellers` and skip rows where `price_unreliable` is true.

## Which shop to buy from

"این هدفون رو از کی بخرم؟" plus a product id from search.

`product_sellers` with `limit: 5`. Read `score_text` and `buyer_notes` (recent order volume and how many buyers chased an order). `shop_profile` on the shop id adds domain, city, and enamad.

## Is the price low right now

"الان ارزونه یا نه؟"

`product_price_chart`. Compare `current_cheapest_toman` with the **minimum** series low, not the average.

## In a shop near me

"کدوم فروشگاه حضوری اینو داره؟"

`product_stores`. Rows include city, address, hours, and whether the shop is open.

## Two products, what actually differs

"سونی WH-1000XM5 با XM6 چه فرقی داره؟"

Search both, then `compare_products` with the two ids. Only specs that differ come back.

## What is this thing

"درباره این مدل یه توضیح بده"

`product_guide`. That text is Torob's write-up on the product page. Torob does not publish buyer reviews with a date, a like count, or pros and cons. Shop trust is `buyer_notes` on `product_sellers`.
