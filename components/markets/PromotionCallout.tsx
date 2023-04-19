import React from "react";
import { PromotedMarket } from "lib/cms/get-promoted-markets";
import Modal from "components/ui/Modal";
import { Dialog } from "@headlessui/react";
import { AiFillFire } from "react-icons/ai";
import Image from "next/image";
import moment from "moment";

export const MarketPromotionCallout = (props: {
  promotion: PromotedMarket;
}) => {
  const now = new Date();
  const startDate = new Date(props.promotion.timeSpan[0]);
  const endDate = new Date(props.promotion.timeSpan[1]);
  const isActive = startDate < now && endDate > now;

  const [modalIsOpen, setModalIsOpen] = React.useState(false);

  return (
    <>
      {isActive && (
        <div>
          <div className="flex justify-center">
            <div
              className="rounded-md bg-orange-200 p-4 inline-flex font-bold text-orange-900"
              onClick={() => setModalIsOpen(!modalIsOpen)}
            >
              Promoted Market!
              <AiFillFire size={24} />
            </div>
          </div>

          <Modal open={modalIsOpen} onClose={() => setModalIsOpen(false)}>
            <Dialog.Panel
              className="flex flex-col gap-y-[20px] justify-center items-center bg-white 
    w-full max-w-[520px]  rounded-ztg-10"
            >
              <div className="w-full h-64 relative rounded-t-ztg-10 overflow-hidden">
                <Image
                  alt="AI Logan?"
                  src={props.promotion.imageUrl}
                  fill
                  style={{
                    objectFit: "cover",
                  }}
                />
              </div>
              <div className="px-16 py-8">
                <h2 className="mb-12 text-xl center">
                  This market has promotional incentives!
                </h2>
                <div className="mb-12">
                  <ol className="list-decimal">
                    <li className="mb-6 font-light">
                      Join our trading campaign on the prediction market for
                      "Will SpaceX's Starship reach outer space before the end
                      of Q1?" and get the chance to win big!
                    </li>
                    <li className="mb-6 font-light">
                      Make trades of{" "}
                      <b className="font-medium">
                        {props.promotion.tradeRequirement}+ $ZTG{" "}
                      </b>
                      and you'll be entered into a lucky draw to win a massive
                      <b className="font-medium">
                        {" "}
                        {props.promotion.prize} $ZTG
                      </b>{" "}
                      prize.
                    </li>
                    <li className="mb-6 font-light">
                      The campaign will only run until{" "}
                      <b className="font-medium">
                        {moment(props.promotion.timeSpan[1]).calendar()}
                      </b>
                      , so make sure to get your trades in before the deadline.
                    </li>
                    <li className="mb-6 font-light">
                      Don't miss out on this exciting opportunity to test your
                      knowledge and earn rewards!
                    </li>
                  </ol>
                </div>
                <button
                  onClick={() => setModalIsOpen(false)}
                  className={`ztg-transition bg-ztg-blue text-white focus:outline-none disabled:opacity-20 disabled:cursor-default 
        rounded-full w-full  font-bold text-ztg-16-150 h-ztg-56`}
                >
                  Got it!
                </button>
              </div>
            </Dialog.Panel>
          </Modal>
        </div>
      )}
    </>
  );
};
