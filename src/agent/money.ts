// X6 step 7: a plain check before the model is called. A question about buying, selling, investing,
// stocks or futures gets one fixed line and no model call (and no fixed plan): the planner plans
// sightings, and the Forecast lab shows what satellites can and cannot forecast. Pure, no I/O.

export const MONEY_LINE =
  'The planner does not give financial advice. The Forecast lab shows what satellites can and cannot forecast.';

// Words about trading or investing. "buy" and "sell" count only next to a market word, so "buy a
// telescope" or "sell out" do not trip it; "stock(s)", "futures", "invest...", "shares", "crypto",
// "trading" and the like count alone.
const ALONE =
  /\b(stocks?|shares|futures|invest(?:ing|ment|ments|or|ors|ed)?|crypto(?:currency)?|bitcoin|portfolio|day[- ]?trad(?:e|ing)|trading|options contracts?|hedge funds?|short(?:ing)? the|commodit(?:y|ies) prices?)\b/i;
const VERB = /\b(buy|buying|bought|sell|selling|sold|short)\b/i;
const MARKET = /\b(corn|soy(?:beans?)?|wheat|oil|gold|grain|commodit(?:y|ies)|market|price|prices|contracts?|etf|fund|tickers?)\b/i;

export function isMoneyQuestion(text: string): boolean {
  if (ALONE.test(text)) return true;
  return VERB.test(text) && MARKET.test(text);
}
