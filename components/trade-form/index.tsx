import { Tab } from "@headlessui/react";
import { ZTG } from "@zeitgeistpm/sdk-next";
import Decimal from "decimal.js";
import {
  useTradeItem,
  useTradeMaxAssetAmount,
  useTradeMaxBaseAmount,
  useTradeTransaction,
} from "lib/hooks/trade";
import { useNotificationStore } from "lib/stores/NotificationStore";
import { useStore } from "lib/stores/Store";
import { observer } from "mobx-react";
import React, { useEffect, useMemo, useState } from "react";
import { capitalize } from "lodash";
import { from } from "rxjs";
import { useDebounce } from "use-debounce";
import RangeInput from "../ui/RangeInput";
import TransactionButton from "../ui/TransactionButton";
import TradeTab, { TradeTabType } from "./TradeTab";
import { useForm } from "react-hook-form";
import { useExtrinsic } from "lib/hooks/useExtrinsic";
import { useQueryClient } from "@tanstack/react-query";
import { useSdkv2 } from "lib/hooks/useSdkv2";
import {
  tradeItemStateRootQueryKey,
  useTradeItemState,
} from "lib/hooks/queries/useTradeItemState";
import { calcSpotPrice } from "lib/math";
import TradeResult from "components/markets/TradeResult";

const TradeForm = observer(() => {
  const notificationStore = useNotificationStore();
  const [tabIndex, setTabIndex] = useState<number>(0);
  const [sdk, id] = useSdkv2();
  const { register, formState, watch, setValue, reset } = useForm<{
    percentage: string;
    assetAmount: string;
    baseAmount: string;
  }>({
    defaultValues: { percentage: "0", assetAmount: "0", baseAmount: "0" },
  });

  const store = useStore();
  const { wallets } = store;
  const signer = wallets.getActiveSigner();

  const { data: tradeItem, set: setTradeItem } = useTradeItem();
  const { data: tradeItemState } = useTradeItemState(tradeItem);
  const maxBaseAmount = useTradeMaxBaseAmount(tradeItem);
  const maxAssetAmount = useTradeMaxAssetAmount(tradeItem);

  const maxBaseAmountDecimal = new Decimal(maxBaseAmount ?? 0).div(ZTG);
  const maxAssetAmountDecimal = new Decimal(maxAssetAmount ?? 0).div(ZTG);

  const [fee, setFee] = useState<string>("0.00");
  const [percentageDisplay, setPercentageDisplay] = useState<string>("0");
  const queryClient = useQueryClient();
  const baseSymbol = tradeItemState?.pool.baseAsset.toUpperCase() ?? "ZTG";

  const type = tradeItem?.action ?? "buy";

  const assetAmount = watch("assetAmount");
  const baseAmount = watch("baseAmount");

  const averagePrice = useMemo<string>(() => {
    if (!Number(assetAmount) || !Number(baseAmount)) {
      return "0";
    } else return new Decimal(baseAmount).div(assetAmount).toFixed(2);
  }, [assetAmount, baseAmount]);

  const predictionAfterTrade = useMemo<Decimal>(() => {
    if (!Number(assetAmount) || !Number(baseAmount) || tradeItemState == null) {
      return new Decimal(0);
    } else {
      if (tradeItem.action === "buy") {
        return calcSpotPrice(
          tradeItemState.poolBaseBalance.add(new Decimal(baseAmount).mul(ZTG)),
          tradeItemState.baseWeight,
          tradeItemState.poolAssetBalance.sub(
            new Decimal(assetAmount).mul(ZTG),
          ),
          tradeItemState.assetWeight,
          tradeItemState.swapFee,
        );
      } else {
        return calcSpotPrice(
          tradeItemState.poolBaseBalance.sub(new Decimal(baseAmount).mul(ZTG)),
          tradeItemState.baseWeight,
          tradeItemState.poolAssetBalance.add(
            new Decimal(assetAmount).mul(ZTG),
          ),
          tradeItemState.assetWeight,
          tradeItemState.swapFee,
        );
      }
    }
  }, [assetAmount, baseAmount, tradeItemState]);

  const priceImpact = useMemo<string>(() => {
    if (tradeItemState == null || predictionAfterTrade.eq(0)) {
      return "0";
    } else {
      return predictionAfterTrade
        .div(tradeItemState.spotPrice)
        .sub(1)
        .mul(100)
        .toFixed(2);
    }
  }, [tradeItemState, predictionAfterTrade]);

  const transaction = useTradeTransaction(tradeItem, assetAmount);

  const {
    send: swapTx,
    isSuccess,
    isLoading,
  } = useExtrinsic(() => transaction, {
    onSuccess: () => {
      notificationStore.pushNotification(
        `Successfully ${
          tradeItem.action === "buy" ? "bought" : "sold"
        } ${assetAmount} ${
          tradeItemState.asset.category.ticker
        } for ${baseAmount} ${baseSymbol}`,
        { type: "Success" },
      );
      setPercentageDisplay("0");
      queryClient.invalidateQueries([
        id,
        tradeItemStateRootQueryKey,
        tradeItem.action,
        JSON.stringify(tradeItem.assetId),
        wallets?.activeAccount?.address,
      ]);
    },
  });

  const [debouncedTransactionHash] = useDebounce(
    transaction?.hash.toString(),
    150,
  );

  useEffect(() => {
    if (debouncedTransactionHash == null) {
      return;
    }
    const sub = from(transaction.paymentInfo(signer.address)).subscribe(
      (fee) => {
        setFee(new Decimal(fee.partialFee.toString()).div(ZTG).toFixed(3));
      },
    );
    return () => sub.unsubscribe();
  }, [debouncedTransactionHash]);

  useEffect(() => {
    const sub = watch((value, { name, type }) => {
      const changedByUser = type != null;
      if (name === "percentage" && changedByUser) {
        const percentage = new Decimal(value.percentage).div(100);
        const baseAmount = maxBaseAmountDecimal
          .mul(percentage)
          .toDecimalPlaces(4, Decimal.ROUND_DOWN);
        const assetAmount = maxAssetAmountDecimal
          .mul(percentage)
          .toDecimalPlaces(4, Decimal.ROUND_DOWN);
        setValue("baseAmount", baseAmount.toString());
        setValue("assetAmount", assetAmount.toString());
      }
      if (name === "assetAmount" && changedByUser) {
        const assetAmount = value.assetAmount === "" ? "0" : value.assetAmount;
        const assetAmountDecimal = new Decimal(assetAmount);
        const percentage = maxAssetAmountDecimal.gt(0)
          ? assetAmountDecimal
              .div(maxAssetAmountDecimal)
              .mul(100)
              .toDecimalPlaces(0, Decimal.ROUND_DOWN)
          : new Decimal(0);
        const baseAmount = percentage
          .mul(maxBaseAmountDecimal)
          .div(100)
          .toDecimalPlaces(4, Decimal.ROUND_DOWN);
        setPercentageDisplay(percentage.toString());
        setValue("baseAmount", baseAmount.toString());
      }
      if (name === "baseAmount" && changedByUser) {
        const baseAmount = value.baseAmount === "" ? "0" : value.baseAmount;
        const baseAmountDecimal = new Decimal(baseAmount);
        const percentage = maxBaseAmountDecimal.gt(0)
          ? baseAmountDecimal
              .div(maxBaseAmountDecimal)
              .mul(100)
              .toDecimalPlaces(0, Decimal.ROUND_DOWN)
          : new Decimal(0);
        const assetAmount = percentage
          .mul(maxAssetAmountDecimal)
          .div(100)
          .toDecimalPlaces(4, Decimal.ROUND_DOWN);
        setPercentageDisplay(percentage.toString());
        setValue("assetAmount", assetAmount.toString());
      }
    });

    return () => sub.unsubscribe();
  }, [watch, maxAssetAmountDecimal, maxBaseAmountDecimal, setValue]);

  return (
    <>
      {isSuccess === true ? (
        <TradeResult
          type={tradeItem.action}
          amount={new Decimal(assetAmount)}
          tokenName={tradeItemState?.asset.category.name}
          baseTokenAmount={new Decimal(baseAmount)}
          baseToken={baseSymbol}
          marketId={tradeItemState?.market.marketId}
          marketQuestion={tradeItemState?.market.question}
        />
      ) : (
        <form
          className="bg-white rounded-[10px]"
          onSubmit={(e) => {
            e.preventDefault();
            swapTx();
          }}
        >
          <Tab.Group
            defaultIndex={0}
            onChange={(index: TradeTabType) => {
              setTabIndex(index);
              if (index === TradeTabType.Buy) {
                setTradeItem({
                  ...tradeItem,
                  action: "buy",
                });
              }
              if (index === TradeTabType.Sell) {
                setTradeItem({
                  ...tradeItem,
                  action: "sell",
                });
              }
              reset();
              setPercentageDisplay("0");
            }}
            selectedIndex={tabIndex}
          >
            <Tab.List className="flex justify-between h-[71px] text-center rounded-[10px]">
              <Tab
                as={TradeTab}
                selected={type === "buy"}
                className="rounded-tl-[10px]"
              >
                Buy
              </Tab>
              <Tab
                as={TradeTab}
                selected={type === "sell"}
                className="rounded-tr-[10px]"
              >
                Sell
              </Tab>
            </Tab.List>
          </Tab.Group>
          <div className="flex flex-col p-[30px]">
            <div className="center h-[87px]" style={{ fontSize: "58px" }}>
              <input
                type="number"
                {...register("assetAmount", {
                  required: true,
                  min: "0",
                  max: maxAssetAmount?.div(ZTG).toFixed(4),
                })}
                step="any"
                className="w-full bg-transparent outline-none !text-center text-[58px]"
                autoFocus
              />
            </div>
            <div className="center h-[48px] font-semibold capitalize text-[28px]">
              {tradeItemState?.asset.category.name}
            </div>
            <div className="font-semibold text-center mb-[20px]">For</div>
            <div className="h-[56px] bg-anti-flash-white center text-ztg-18-150 mb-[20px]">
              <input
                type="number"
                {...register("baseAmount", {
                  required: true,
                  min: "0",
                  max: maxBaseAmount?.div(ZTG).toFixed(4),
                })}
                step="any"
                className="w-full bg-transparent outline-none !text-center"
              />
              <div className="mr-[10px]">{baseSymbol}</div>
            </div>
            <RangeInput
              min="0"
              max="100"
              value={percentageDisplay}
              onValueChange={setPercentageDisplay}
              minLabel="0 %"
              step="0.1"
              valueSuffix="%"
              maxLabel="100 %"
              className="mb-[20px]"
              {...register("percentage")}
            />
            <div className="text-center mb-[20px]">
              <div className="text-ztg-14-150">
                <div className="mb-[10px]">
                  <span className="text-sky-600">Average Price: </span>
                  {averagePrice} {baseSymbol}
                </div>
                <div className="mb-[10px]">
                  <span className="text-sky-600">Prediction After Trade: </span>
                  {predictionAfterTrade.toFixed(2)} {baseSymbol} (
                  {predictionAfterTrade.mul(100).toFixed(0)}%)
                </div>
                <div className="mb-[10px]">
                  <span className="text-sky-600">Price impact: </span>
                  {priceImpact}%
                </div>
              </div>
            </div>
            <TransactionButton
              disabled={!formState.isValid || isLoading === true}
              className="h-[56px]"
            >
              <div className="center font-normal h-[20px]">
                Confirm {`${capitalize(tradeItem.action)}`}
              </div>
              <div className="center font-normal text-ztg-12-120 h-[20px]">
                Trading fee: {fee} {baseSymbol}
              </div>
            </TransactionButton>
          </div>
        </form>
      )}
    </>
  );
});

export default TradeForm;