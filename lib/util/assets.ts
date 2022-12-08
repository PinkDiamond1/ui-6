import Decimal from "decimal.js";

export const getCurrentPrediction = (
  assets: { price: number }[],
  market: {
    marketType: { categorical?: string; scalar?: string };
    categories: { color: string; name: string; ticker: string }[];
  },
): string => {
  if (market.marketType.categorical) {
    let [highestPrice, highestPriceIndex] = [0, 0];
    assets.forEach((asset, index) => {
      if (asset.price > highestPrice) {
        highestPrice = asset.price;
        highestPriceIndex = index;
      }
    });
    return market.categories[highestPriceIndex].name;
  } else {
    const bounds: number[] = market.marketType.scalar
      .split(",")
      .map((b) => Number(b));

    const range = Number(bounds[1]) - Number(bounds[0]);
    const significantDigits = bounds[1].toString().length;
    const longPrice = assets[0].price;
    const shortPrice = assets[1].price;

    const shortPricePrediction = range * (1 - shortPrice) + bounds[0];
    const longPricePrediction = range * longPrice + bounds[0];
    const averagePricePrediction =
      (longPricePrediction + shortPricePrediction) / 2;
    return new Decimal(averagePricePrediction)
      .toSignificantDigits(significantDigits)
      .toString();
  }
};