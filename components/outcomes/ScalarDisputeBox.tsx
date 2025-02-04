import {
  getScalarBounds,
  IndexerContext,
  isRpcSdk,
  Market,
} from "@zeitgeistpm/sdk-next";
import { AmountInput, DateTimeInput } from "components/ui/inputs";
import TransactionButton from "components/ui/TransactionButton";
import Decimal from "decimal.js";
import { ZTG } from "lib/constants";
import { useChainConstants } from "lib/hooks/queries/useChainConstants";
import { useMarketDisputes } from "lib/hooks/queries/useMarketDisputes";
import { useSdkv2 } from "lib/hooks/useSdkv2";
import { useNotifications } from "lib/state/notifications";
import { useWallet } from "lib/state/wallet";
import { extrinsicCallback, signAndSend } from "lib/util/tx";
import moment from "moment";
import { useState } from "react";

const ScalarDisputeBox = ({
  market,
  onSuccess,
}: {
  market: Market<IndexerContext>;
  onSuccess?: () => void;
}) => {
  const [sdk] = useSdkv2();
  const notificationStore = useNotifications();
  const { data: constants } = useChainConstants();

  const disputeBond = constants?.markets.disputeBond;
  const disputeFactor = constants?.markets.disputeFactor;
  const tokenSymbol = constants?.tokenSymbol;

  const { data: disputes } = useMarketDisputes(market);
  const lastDispute = disputes?.[disputes.length - 1];

  const wallet = useWallet();
  const signer = wallet.getActiveSigner();

  const bondAmount =
    disputes && disputeBond && disputeFactor
      ? disputeBond + disputes.length * disputeFactor
      : disputeBond;

  const bounds = getScalarBounds(market).unwrap();

  const isScalarDate = market.scalarType === "date";

  const [scalarReportValue, setScalarReportValue] = useState(() => {
    if (isScalarDate) {
      return ((bounds[1].toNumber() + bounds[0].toNumber()) / 2).toFixed(0);
    } else {
      return "";
    }
  });

  const getPreviousReport = () => {
    const reportVal = new Decimal(
      lastDispute?.outcome.asScalar.toString() ?? market.report?.outcome.scalar,
    )
      .div(ZTG)
      .toString();
    if (isScalarDate) {
      return moment(Number(reportVal)).format("YYYY-MM-DD HH:mm");
    } else {
      return reportVal;
    }
  };

  const handleSignTransaction = async () => {
    if (!isRpcSdk(sdk) || !signer) return;
    const outcomeReport = {
      Scalar: new Decimal(scalarReportValue).mul(ZTG).toFixed(0),
    };

    const callback = extrinsicCallback({
      api: sdk.api,
      notifications: notificationStore,
      successCallback: async () => {
        notificationStore.pushNotification("Outcome Disputed", {
          type: "Success",
        });
        onSuccess?.();
      },
      failCallback: (error) => {
        notificationStore.pushNotification(error, {
          type: "Error",
        });
      },
    });

    const tx = sdk.api.tx.predictionMarkets.dispute(
      market.marketId,
      outcomeReport,
    );
    await signAndSend(tx, signer, callback);
  };

  return (
    <div className="p-[30px] flex flex-col items-center gap-y-3">
      <div className="font-bold text-[22px]">Dispute Outcome</div>
      <div className="text-center mb-[20px]">
        Bond will start at {disputeBond} {tokenSymbol}, increasing by{" "}
        {disputeFactor} {tokenSymbol} for each dispute.{" "}
        <span className="font-bold">
          Bonds will be slashed if the reported outcome is deemed to be
          incorrect
        </span>
      </div>
      {isScalarDate ? (
        <DateTimeInput
          timestamp={scalarReportValue}
          onChange={setScalarReportValue}
          isValidDate={(current) => {
            const loBound = bounds[0].toNumber();
            const hiBound = bounds[1].toNumber();
            if (current.valueOf() >= loBound && current.valueOf() <= hiBound) {
              return true;
            }
            return false;
          }}
        />
      ) : (
        <AmountInput
          value={scalarReportValue}
          min={bounds?.[0].toString()}
          max={bounds?.[1].toString()}
          onChange={(val) => setScalarReportValue(val)}
          showErrorMessage={false}
        />
      )}
      <div className="flex flex-col item-center text-center">
        <span className="text-sky-600 text-[14px]">Previous Report:</span>
        <span className="">{getPreviousReport()}</span>
      </div>
      {bondAmount !== disputeBond &&
      bondAmount !== undefined &&
      disputeFactor !== undefined ? (
        <div className="flex flex-col item-center text-center">
          <span className="text-sky-600 text-[14px]">Previous Bond:</span>
          <span className="">{bondAmount - disputeFactor}</span>
        </div>
      ) : (
        <></>
      )}
      <TransactionButton
        className="mb-ztg-10 mt-[20px]"
        onClick={handleSignTransaction}
      >
        Confirm Dispute
      </TransactionButton>
    </div>
  );
};

export default ScalarDisputeBox;
