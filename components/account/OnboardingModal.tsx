import { BaseDotsamaWallet } from "lib/wallets/base-dotsama-wallet";
import { PolkadotjsWallet } from "lib/wallets/polkadotjs-wallet";
import { SubWallet } from "lib/wallets/subwallet";
import { TalismanWallet } from "lib/wallets/talisman-wallet";
import { observer } from "mobx-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { getWallets } from "@talismn/connect-wallets";

interface StepperProps {
  steps: number;
  currentStep: number;
  onStepClick?: (step: number) => void;
}

const Stepper = ({ steps, currentStep, onStepClick }: StepperProps) => {
  return (
    <div className="flex gap-x-[18px]">
      {Array(steps)
        .fill(null)
        .map((_, index) => (
          <button
            onClick={() => onStepClick(index)}
            disabled={index === currentStep}
            className={`rounded-full h-[7px] w-[7px] ${
              index === currentStep ? "bg-black" : "bg-sky-600"
            }`}
          ></button>
        ))}
    </div>
  );
};

interface TextSectionProps {
  headerText: string;
  bodyText: string;
  leftButtonText?: string;
  rightButtonText?: string;
  onLeftButtonClick?: () => void;
  onRightButtonClick?: () => void;
}
const TextSection = ({
  headerText,
  bodyText,
  leftButtonText,
  rightButtonText,
  onLeftButtonClick,
  onRightButtonClick,
}: TextSectionProps) => {
  return (
    <>
      <div className="font-bold text-ztg-22-120">{headerText}</div>
      <div className="text-center mb-auto">{bodyText}</div>
      <div className="flex justify-center  gap-x-[20px] w-full px-[20px] h-[56px] font-medium">
        {leftButtonText && (
          <button
            className="rounded-[100px] border-2 border-pastel-blue w-full"
            onClick={onLeftButtonClick}
          >
            {leftButtonText}
          </button>
        )}
        {rightButtonText && (
          <button
            className="rounded-[100px] border-2 border-pastel-blue w-full"
            onClick={onRightButtonClick}
          >
            {rightButtonText}
          </button>
        )}
      </div>
    </>
  );
};

const walletsConfig = [
  new TalismanWallet(),
  new PolkadotjsWallet(),
  new SubWallet(),
];

const WalletSelection = observer(() => {
  const [selectedWallet, setSelectedWallet] = useState<string>();

  useEffect(() => {
    const ref = setInterval(() => {
      const wallets = getWallets();
      const wallet = wallets.find(
        (wallet) => wallet.extensionName === selectedWallet,
      );

      console.log("selectedinstalled", wallet?.installed);
    }, 500);

    return () => {
      clearInterval(ref);
    };
  }, [selectedWallet]);

  const handleWalletSelect = async (wallet: BaseDotsamaWallet) => {
    window.open(wallet.installUrl);
    setSelectedWallet(wallet.extensionName);
  };

  return (
    <>
      {walletsConfig.map((wallet, index) => (
        <button
          key={index}
          className="flex items-center justify-center h-[56px] border border-pastel-blue rounded-ztg-10 text-center w-full"
          onClick={() => handleWalletSelect(wallet)}
        >
          <Image
            src={wallet.logo.src}
            alt={wallet.logo.alt}
            width={30}
            height={30}
            quality={100}
          />
          <div className="font-medium text-ztg-18-150 ml-[15px]">
            {wallet.title}
          </div>
        </button>
      ))}
    </>
  );
});

const ExchangeTypeSelection = () => {
  const exchangeTypes = [
    {
      name: "With Crypto or Fiat (CEX)",
      disabled: false,
    },
    {
      name: "Credit Card (Coming Soon)",
      disabled: true,
    },
    {
      name: "With Crypto (DEX) (Coming Soon)",
      disabled: true,
    },
  ];

  return (
    <>
      {exchangeTypes.map((exchangeType, index) => (
        <button
          key={index}
          disabled={exchangeType.disabled}
          className={`flex items-center justify-center h-[56px] rounded-ztg-10 text-center w-full ${
            exchangeType.disabled === true
              ? "bg-gray-light-2"
              : "border border-pastel-blue"
          }`}
        >
          <div className="font-medium text-ztg-18-150 ml-[15px]">
            {exchangeType.name}
          </div>
        </button>
      ))}
    </>
  );
};

const OnBoardingModal = () => {
  const [step, setStep] = useState(0);
  return (
    <div
      className="flex flex-col gap-y-[20px] justify-center items-center bg-white border 
                border-black h-[438px] w-full max-w-[526px] p-[30px] rounded-ztg-10"
    >
      <div className="rounded-full w-[120px] h-[120px] mb-auto">
        <Image
          alt="AI Logan?"
          src={"/misc/face.png"}
          width={120}
          height={120}
        />
      </div>
      {step === 0 && (
        <TextSection
          headerText="Welcome to Zeitgeist"
          bodyText="Hey, it looks like you don’t have any wallets installed. Let me be your Guide and help you get one to start using the App to its full extent"
          rightButtonText="Continue"
          onRightButtonClick={() => setStep(1)}
        />
      )}
      {step === 1 && (
        <TextSection
          headerText="Getting Started"
          bodyText="First thing you need to do is to Install the right extension for your account. To do that, you need to click the wallet icon to go to its download page (e.g. Talisman)."
          leftButtonText="Back"
          rightButtonText="Continue"
          onLeftButtonClick={() => setStep(0)}
          onRightButtonClick={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <TextSection
          headerText="Getting Your Wallet"
          bodyText="Finally, you’re just about to become a proud member of Zeitgeist. And we hope you’ll have a nice ride and unforgettable experience with Prediction Markets."
          leftButtonText="Back"
          rightButtonText="Continue"
          onLeftButtonClick={() => setStep(1)}
          onRightButtonClick={() => setStep(3)}
        />
      )}
      {step === 3 && <WalletSelection />}
      {step === 4 && (
        <TextSection
          headerText="Success on getting a wallet!"
          bodyText="Now to get ZTG."
          leftButtonText="Back"
          rightButtonText="Continue"
          onLeftButtonClick={() => setStep(3)}
          onRightButtonClick={() => setStep(5)}
        />
      )}
      {step === 5 && <ExchangeTypeSelection />}
      <Stepper steps={6} currentStep={step} onStepClick={setStep} />
    </div>
  );
};

export default OnBoardingModal;
