export const SEAT_ROWS = 12;
export const SEAT_LETTERS = ["A", "B", "C", "D"] as const;

export type SeatId = `${number}${(typeof SEAT_LETTERS)[number]}`;

export type Seat = {
  id: SeatId;
  row: number;
  letter: (typeof SEAT_LETTERS)[number];
};

export function buildSeatLayout(): Seat[] {
  const seats: Seat[] = [];
  for (let row = 1; row <= SEAT_ROWS; row++) {
    for (const letter of SEAT_LETTERS) {
      seats.push({ id: `${row}${letter}` as SeatId, row, letter });
    }
  }
  return seats;
}

export const ALL_SEATS = buildSeatLayout();

export function isValidSeatId(id: string): id is SeatId {
  return ALL_SEATS.some((seat) => seat.id === id);
}

export function seatTripKey(routeId: string, date: string, time: string): string {
  return `${routeId}:${date}:${time}`;
}

export function parseSeats(seatsJson: string): string[] {
  try {
    const parsed = JSON.parse(seatsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
