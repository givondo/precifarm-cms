type AlertBannerProps = {
  tone: "error" | "success";
  message: string;
};

export function AlertBanner({ tone, message }: AlertBannerProps) {
  const cls =
    tone === "error"
      ? "text-sm text-red-600 mb-4 bg-red-50 border border-red-200 rounded px-3 py-2"
      : "text-sm text-green-700 mb-4 bg-green-50 border border-green-200 rounded px-3 py-2";

  return <p className={cls}>{message}</p>;
}
