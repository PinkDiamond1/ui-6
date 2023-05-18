import { Dialog } from "@headlessui/react";
import type { ApiPromise } from "@polkadot/api";
import { isRpcSdk } from "@zeitgeistpm/sdk-next";
import FormTransactionButton from "components/ui/FormTransactionButton";
import Modal from "components/ui/Modal";
import Decimal from "decimal.js";
import { ZTG } from "lib/constants";
import { ChainName } from "lib/constants/chains";
import { useAssetMetadata } from "lib/hooks/queries/useAssetMetadata";
import { useExtrinsicFee } from "lib/hooks/queries/useExtrinsicFee";
import { useCrossChainExtrinsic } from "lib/hooks/useCrossChainExtrinsic";
import { useSdkv2 } from "lib/hooks/useSdkv2";
import { useChain } from "lib/state/cross-chain";
import { useNotifications } from "lib/state/notifications";
import { useWallet } from "lib/state/wallet";
import { useState } from "react";
import { useForm } from "react-hook-form";
import Transfer from "./Transfer";

const WithdrawButton = ({ toChain, tokenSymbol, balance, foreignAssetId }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        className="border-gray-300 text-sm border-2 rounded-full py-2 w-[110px] mr-2"
        onClick={() => setIsOpen(true)}
      >
        Withdraw
      </button>
      <Modal open={isOpen} onClose={() => setIsOpen(false)}>
        <WithdrawModal
          toChain={toChain}
          tokenSymbol={tokenSymbol}
          balance={balance}
          foreignAssetId={foreignAssetId}
          onSuccess={() => setIsOpen(false)}
        />
      </Modal>
    </>
  );
};

const createWithdrawExtrinsic = (
  api: ApiPromise,
  amount: string,
  address: string,
  foreignAssetId: number,
) => {
  const accountId = api.createType("AccountId32", address).toHex();

  const account = {
    parents: 1,
    interior: { X1: { AccountId32: { id: accountId, network: "Any" } } },
  };

  return api.tx.xTokens.transfer(
    { ForeignAsset: foreignAssetId },
    amount,
    { V1: account },
    "100000000000",
  );
};

const WithdrawModal = ({
  toChain,
  tokenSymbol,
  balance,
  foreignAssetId,
  onSuccess,
}: {
  toChain: ChainName;
  tokenSymbol: string;
  balance: Decimal;
  foreignAssetId: number;
  onSuccess: () => void;
}) => {
  const { register, handleSubmit, getValues, formState } = useForm({
    reValidateMode: "onChange",
    mode: "onChange",
  });

  const notificationStore = useNotifications();
  const wallet = useWallet();
  const [sdk] = useSdkv2();
  const { chain } = useChain(toChain);

  const { data: fee } = useExtrinsicFee(
    isRpcSdk(sdk)
      ? createWithdrawExtrinsic(
          sdk.api,
          "100000000000",
          wallet.activeAccount.address,
          foreignAssetId,
        )
      : null,
  );

  const { send: transfer, isLoading } = useCrossChainExtrinsic(
    () => {
      if (isRpcSdk(sdk)) {
        const formValue = getValues();
        const amount = formValue.amount;

        const tx = createWithdrawExtrinsic(
          sdk.api,
          new Decimal(amount).mul(ZTG).toFixed(0),
          wallet.activeAccount.address,
          foreignAssetId,
        );
        return tx;
      }
    },
    "Zeitgeist",
    toChain,
    {
      onSourceSuccess: () => {
        notificationStore.pushNotification(
          `Moving ${tokenSymbol} to ${toChain}`,
          {
            type: "Info",
            autoRemove: true,
          },
        );
      },
      onDestinationSuccess: () => {
        notificationStore.pushNotification(
          `Successfully moved ${tokenSymbol} to ${toChain}`,
          {
            type: "Success",
          },
        );
        onSuccess();
      },
    },
  );

  const onSubmit = () => {
    transfer();
  };

  return (
    <Dialog.Panel className="w-full max-w-[462px] rounded-[10px] bg-white p-[30px]">
      <h3 className="text-center mb-8">Withdraw</h3>
      <div className="flex flex-col w-full items-center gap-8 mt-[20px] text-ztg-18-150 font-semibold">
        <Transfer destinationChain={toChain} sourceChain="Zeitgeist" />
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="w-full flex flex-col items-center"
        >
          <div className="h-[56px] bg-anti-flash-white center text-ztg-18-150 relative font-normal w-full">
            <input
              {...register("amount", {
                required: {
                  value: true,
                  message: "Value is required",
                },
                validate: (value) => {
                  if (balance.div(ZTG).lessThan(value)) {
                    return `Insufficient balance. Current balance: ${balance
                      .div(ZTG)
                      .toFixed(3)}`;
                  } else if (value <= 0) {
                    return "Value cannot be zero or less";
                  }
                },
              })}
              type="number"
              className="w-full bg-transparent outline-none !text-center"
              step="any"
            />
            <div className="mr-[10px] absolute right-0">{tokenSymbol}</div>
          </div>
          <div className="text-vermilion text-ztg-12-120 my-[4px] h-[16px]">
            <>{formState.errors["amount"]?.message}</>
          </div>
          <div className="center font-normal text-ztg-12-120 mb-[16px] text-sky-600">
            Zeitgeist fee:
            <span className="text-black ml-1">
              {new Decimal(fee?.partialFee.toString() ?? 0).div(ZTG).toFixed(3)}
            </span>
          </div>
          <div className="center font-normal text-ztg-12-120 mb-[10px] text-sky-600">
            {toChain} fee:
            <span className="text-black ml-1">{chain.withdrawFee}</span>
          </div>
          <FormTransactionButton
            className="w-full max-w-[250px]"
            disabled={formState.isValid === false || isLoading}
          >
            Confirm Withdraw
          </FormTransactionButton>
        </form>
      </div>
    </Dialog.Panel>
  );
};

export default WithdrawButton;