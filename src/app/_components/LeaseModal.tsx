import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogBackdrop, DialogPanel } from "@headlessui/react";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { COST_PER_GPU, CREDIT_PER_DOLLAR } from "@/constants";
import { reactClient } from "@/trpc/react";
import { formatLargeNumber } from "@/utils/utils";

const steps = [
  { name: "Select Model", status: "current" },
  { name: "Review Pricing", status: "upcoming" },
  { name: "Complete", status: "upcoming" },
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

interface LeaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedModel: string | null;
  step: number | null;
  successUrl?: boolean;
  canceledUrl?: boolean;
}

export default function LeaseModal({
  isOpen,
  onClose,
  savedModel,
  step,
  successUrl,
  canceledUrl,
}: LeaseModalProps) {
  const [currentStep, setCurrentStep] = useState(step ?? 0);
  const [model, setModel] = useState(savedModel ?? "");
  const router = useRouter();

  // Update steps array with current status
  const updatedSteps = steps.map((step, index) => ({
    ...step,
    status:
      index === currentStep
        ? "current"
        : index < currentStep
          ? "complete"
          : "upcoming",
  }));

  const user = reactClient.account.getUser.useQuery();
  const utils = reactClient.useUtils();

  const addModelMutation = reactClient.model.addModel.useMutation({
    onSuccess: (gpus) => {
      toast.success("Model added successfully");
      utils.model.getRequiredGpus.setData(model, gpus);
      setCurrentStep(currentStep + 1);
    },
    onError: (error) => {
      toast.error("Failed to add model: " + error.message);
    },
  });

  const checkout = reactClient.credits.checkout.useMutation({
    onError: (e) => {
      toast.error(`Failed getting checkout session: ${e.message}`);
    },
    onSuccess: (url) => {
      router.push(url);
    },
  });

  const dbRequiredGpus = reactClient.model.getRequiredGpus.useQuery(
    model ?? "",
    {
      enabled: !!model && (currentStep === 1 || currentStep === 2),
    },
  );

  const handleNext = () => {
    switch (currentStep) {
      case 0:
        addModelMutation.mutate(model);
        break;
      case 1:
        if (!user.data) {
          router.push(
            `/sign-in?returnTo=${encodeURIComponent(
              `/models?openLeaseModal=true&model=${encodeURIComponent(model)}&step=1`,
            )}`,
          );
          return;
        }
        if (BigInt(user.data.credits) < COST_PER_GPU * requiredGPUS) {
          checkout.mutate({
            purchaseAmount: 250 * Number(requiredGPUS),
            redirectTo: `/models?openLeaseModal=true&model=${encodeURIComponent(model)}&step=1`,
          });
          return;
        }
        setCurrentStep(currentStep + 1);
        break;
      case 2:
        // TODO add mutation to subtract credits
        // Paramaters:
        //  - model
        //  make sure to check that we have enough GPUs. MAX 8
        //
        //  1. grap all models running
        //  2. see if there is an exact match on num gpus
        //  3. start suming lowest gpu models untill you have enough
        //
        //  redirect to model page
        break;
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const requiredGPUS = BigInt(dbRequiredGpus.data ?? 0);
  const totalCost = requiredGPUS * COST_PER_GPU;
  const amountNeeded = totalCost - BigInt(user.data?.credits ?? 0)

  // Add conversion helper
  const convertDollarsToCredits = (dollars: number) => dollars * CREDIT_PER_DOLLAR;
  const convertCreditsToUsd = (credits: number) => credits / CREDIT_PER_DOLLAR;

  // Update the purchase amount handling
  const [useCredits, setUseCredits] = useState(true);
  const [purchaseAmount, setPurchaseAmount] = useState(250 * Number(requiredGPUS));

  // When switching between dollars and credits, convert the amount
  const handleCurrencyToggle = (useCreditsNew: boolean) => {
    setUseCredits(useCreditsNew);
    // Convert amount when switching
    setPurchaseAmount(useCreditsNew 
      ? convertDollarsToCredits(purchaseAmount)
      : convertCreditsToUsd(purchaseAmount)
    );
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="relative z-50">
      <DialogBackdrop className="fixed inset-0 bg-black/30" />

      <div className="fixed inset-0 flex w-screen items-center justify-center p-4">
        <DialogPanel className="w-full max-w-3xl space-y-4 rounded-xl border bg-white p-8">
          <p className="text-center text-xl font-semibold">Lease a Model</p>
          <nav aria-label="Progress">
            <ol role="list" className="flex items-center justify-center">
              {updatedSteps.map((step, stepIdx) => (
                <li
                  key={step.name}
                  className={classNames(
                    stepIdx !== steps.length - 1 ? "pr-8 sm:pr-20" : "",
                    "relative",
                  )}
                >
                  {step.status === "complete" ? (
                    <>
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center"
                      >
                        <div className="h-0.5 w-full bg-green-500" />
                      </div>
                      <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-green-500">
                        <CheckIcon
                          aria-hidden="true"
                          className="h-5 w-5 text-white"
                        />
                      </div>
                    </>
                  ) : step.status === "current" ? (
                    <div className="flex flex-row items-center">
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center "
                      >
                        <div className="h-0.5 w-full bg-gray-200" />
                      </div>
                      <div
                        aria-current="step"
                        className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-green-500 bg-white"
                      >
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full bg-green-500"
                        />
                        <span className="whitespace-nowrap pt-16 text-sm font-semibold">
                          {step.name}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center"
                      >
                        <div className="h-0.5 w-full bg-gray-200" />
                      </div>
                      <div className="group relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-gray-300 bg-white">
                        <span
                          aria-hidden="true"
                          className="h-2.5 w-2.5 rounded-full bg-transparent group-hover:bg-gray-300"
                        />
                        <span className="whitespace-nowrap pt-16 text-sm font-semibold">
                          {step.name}
                        </span>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ol>
          </nav>

          {/* Step Content */}
          {currentStep === 0 && (
            <div className="mx-auto flex w-full max-w-xl flex-col items-center py-8">
              <form
                className="w-full space-y-4"
                onSubmit={(e) => e.preventDefault()}
              >
                <div className="flex flex-col space-y-2">
                  <label
                    htmlFor="modelUrl"
                    className="text-sm font-medium text-gray-700"
                  >
                    HuggingFace Model{" "}
                    <span className="text-red-500">Required</span>
                  </label>
                  <p className="text-sm text-gray-500">
                    HuggingFace Model Repository (e.g.,
                    NousResearch/Hermes-3-Llama-3.1-8B).
                  </p>
                  <div className="flex w-full items-center rounded-lg border border-gray-300 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-500">
                    <span className="whitespace-nowrap pl-4 text-black">
                      https://huggingface.co/
                    </span>
                    <input
                      type="text"
                      id="modelUrl"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="organization/model-name"
                      className="w-full border-0 px-0 py-2 outline-none focus:ring-0"
                    />
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* Step 1 */}
          {currentStep === 1 && (
            <div className="mx-auto flex w-full max-w-xl flex-col items-center py-8">
              <div className="w-full rounded-lg border bg-gray-50 px-6 pt-6 shadow-md">
                <div className="flex flex-col items-center justify-center gap-2 border-b pb-4">
                  <h4 className="font-semibold">Model Cost Summary</h4>
                  <p className="text-sm text-gray-500">{model}</p>
                </div>

                <div className="flex flex-col gap-3 border-b py-4 text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-500">Required GPUs:</span>
                    <span>{formatLargeNumber(requiredGPUS)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-500">Cost per GPU:</span>
                    <span>{formatLargeNumber(COST_PER_GPU)} credits / {formatLargeNumber(COST_PER_GPU / BigInt(CREDIT_PER_DOLLAR))} $</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-500 font-medium">Total Cost:</span>
                    <span>{formatLargeNumber(totalCost)} credits / {formatLargeNumber(totalCost / BigInt(CREDIT_PER_DOLLAR))} $</span>
                  </p>
                </div>

                <div className="flex flex-col gap-2 py-4 text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-500">Your Balance:</span>
                    <span>{formatLargeNumber(user.data?.credits ?? 0)} credits</span>
                  </p>
                  {amountNeeded > 0 && (
                    <p className="flex justify-between text-red-600">
                      <span className='font-medium'>Additional Credits Needed:</span>
                      <span>{formatLargeNumber(amountNeeded)} Credits</span>
                    </p>
                  )}
                </div>
              </div>
              {!user.data ? null : amountNeeded > 0 ? (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-center gap-4">
                    <button
                      onClick={() => handleCurrencyToggle(false)}
                      className={`px-4 py-2 text-sm rounded-lg ${!useCredits ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
                    >
                      Dollars
                    </button>
                    <button
                      onClick={() => handleCurrencyToggle(true)}
                      className={`px-4 py-2 text-sm rounded-lg ${useCredits ? 'bg-green-500 text-white' : 'bg-gray-100'}`}
                    >
                      Credits
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="purchaseAmount" className="text-sm text-gray-500">
                      Purchase Amount ({useCredits ? 'Credits' : 'USD'}):
                    </label>
                    <div className="relative rounded-md shadow-sm">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <span className="text-gray-500 sm:text-sm">{useCredits ? 'C' : '$'}</span>
                      </div>
                      <input
                        id="purchaseAmount"
                        type="text"
                        value={purchaseAmount}
                        onChange={(e) => setPurchaseAmount(Number(e.target.value.replace(/[^0-9]/g, "")))}
                        className="block w-full rounded-md border-0 py-1.5 pl-7 pr-12 text-gray-900 ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                        placeholder="0"
                      />
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <span className="text-gray-500 sm:text-sm">
                          {useCredits ? 'Credits' : 'USD'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Step 2 */}
          {currentStep === 2 && (
            <div className="mx-auto flex w-full max-w-xl flex-col items-center py-8">
              <div className="w-full rounded-lg border bg-gray-50 px-6 pt-6 shadow-md">
                <div className="flex flex-col items-center justify-center gap-2 border-b pb-4">
                  <h4 className="font-semibold">Model Lease Summary</h4>
                  <p className="text-sm text-gray-500">{model}</p>
                </div>

                <div className="flex flex-col gap-3 border-b py-4 text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-500">Required GPUs:</span>
                    <span>{formatLargeNumber(requiredGPUS)}</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-500">Cost per GPU:</span>
                    <span>{formatLargeNumber(COST_PER_GPU)} credits / {formatLargeNumber(COST_PER_GPU / BigInt(CREDIT_PER_DOLLAR))} $</span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-gray-500 font-medium">Total Cost:</span>
                    <span>{formatLargeNumber(totalCost)} credits / {formatLargeNumber(totalCost / BigInt(CREDIT_PER_DOLLAR))} $</span>
                  </p>
                </div>

                <div className="flex flex-col gap-2 py-4 text-sm">
                  <p className="flex justify-between">
                    <span className="text-gray-500">Your Balance:</span>
                    <span>{formatLargeNumber(user.data?.credits ?? 0)} credits</span>
                  </p>
                  <p className="flex justify-between font-medium">
                    <span className="text-gray-500">Remaining Balance:</span>
                    <span>
                      {formatLargeNumber(
                        user.data
                          ? BigInt(user.data.credits) - COST_PER_GPU * requiredGPUS
                          : 0
                      )}{" "}
                      credits
                    </span>
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-center gap-4 py-4">
            <button
              type="button"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={classNames(
                "relative inline-flex h-10 w-36 items-center justify-center gap-1.5 rounded-full border-2 border-gray-100 px-4 py-2.5 text-sm font-semibold",
                currentStep === 0
                  ? "cursor-not-allowed border-transparent bg-gray-100 text-gray-400"
                  : "border-[#e4e7ec] bg-white text-[#344054] hover:border-gray-300",
              )}
            >
              <ChevronLeftIcon className="h-5 w-5" />
              <span>Previous</span>
            </button>

            {currentStep === 1 ? (
              !user.data ? (
                <button
                  onClick={() => router.push(
                    `/sign-in?returnTo=${encodeURIComponent(
                      `/models?openLeaseModal=true&model=${encodeURIComponent(model)}&step=1`,
                    )}`,
                  )}
                  className="relative inline-flex h-10 w-36 items-center justify-center gap-1.5 rounded-full border-2 border-white bg-[#101828] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#101828]/90"
                >
                  Sign In
                </button>
              ) : amountNeeded > 0 ? (
                <div className="flex gap-2">
                  <button
                    onClick={() => checkout.mutate({
                      purchaseAmount: useCredits ? convertCreditsToUsd(purchaseAmount) : purchaseAmount,
                      redirectTo: `/models?openLeaseModal=true&model=${encodeURIComponent(model)}&step=1`,
                    })}
                    disabled={checkout.isLoading}
                    className="relative inline-flex h-10 items-center justify-center gap-1.5 rounded-full border-2 border-white bg-[#101828] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#101828]/90"
                  >
                    {checkout.isLoading ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      "Purchase Credits"
                    )}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="relative inline-flex h-10 w-36 items-center justify-center gap-1.5 rounded-full border-2 border-white bg-[#101828] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#101828]/90"
                >
                  <span>Next</span>
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              )
            ) : (
              <button
                type="button"
                onClick={handleNext}
                disabled={currentStep === steps.length - 1 || addModelMutation.isLoading}
                className={classNames(
                  "relative inline-flex h-10 w-36 items-center justify-center gap-1.5 rounded-full border-2 px-4 py-2.5 text-sm font-semibold",
                  currentStep === steps.length - 1
                    ? "cursor-not-allowed border-transparent bg-gray-100 text-gray-400"
                    : "border-white bg-[#101828] text-white hover:bg-[#101828]/90",
                )}
              >
                {addModelMutation.isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>Next</span>
                    <ChevronRightIcon className="h-5 w-5" />
                  </>
                )}
              </button>
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  );
}
