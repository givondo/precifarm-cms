export const nairobiKisumuRoute = {
  id: "nairobi-kisumu",
  label: "Nairobi – Kisumu",
  from: "Nairobi",
  to: "Kisumu",
  duration: "4h 45m",
  distance: "~345 km",
  vehicle: "Yutong U18",
  fare: 1550,
  departures: ["06:00", "08:00", "10:00", "14:00", "16:00"] as const,
  status: "Current route",
} as const;
