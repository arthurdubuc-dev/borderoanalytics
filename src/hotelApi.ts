import { HOTEL_INVOICE_FIELDS, projectHotelInvoice } from "./hotelInvoice";
import { table, rpc } from "./client";
import { ReadError } from "./readPolicy";
import type {
  HotelStay,
  HotelPayment,
  HotelCommitment,
  RoomingGuest,
} from "./hotels";
export async function loadHotelStays(
  workspaceId: string,
  from: string,
  to: string,
  signal: AbortSignal,
) {
  return table<HotelStay>(
    "hotel_stays",
    {
      select:
        "id,workspace_id,project_id,tour_id,hotel_id,check_in_date,check_out_date,pax_count,status,roadbook_entry_id,hotel:hotels!hotel_id(name,city,address,contact_phone,phone)",
      workspace_id: `eq.${workspaceId}`,
      check_out_date: `gte.${from}`,
      check_in_date: `lte.${to}`,
      order: "check_in_date.asc,id.asc",
    },
    signal,
  );
}
/** Amounts only read after a finance-protected accounting parent is visible under caller RLS. */
export async function loadHotelFinance(stay: HotelStay, signal: AbortSignal) {
  const commitments = await table<HotelCommitment>(
    "payment_tracking",
    {
      select:
        "id,source_id,expected_amount,received_amount,due_date,received_date",
      workspace_id: `eq.${stay.workspace_id}`,
      project_id: `eq.${stay.project_id}`,
      source_type: "eq.hotel_stay",
      source_id: `eq.${stay.id}`,
      order: "id.asc",
    },
    signal,
  );
  if (commitments.length > 1) throw new ReadError("CONTRACT");
  if (commitments[0] && commitments[0].source_id !== stay.id)
    throw new ReadError("CONTRACT");
  if (!commitments.length)
    return {
      commitment: null,
      payments: [] as HotelPayment[],
      invoice: projectHotelInvoice(null),
    };
  const paymentsRequest = table<HotelPayment>(
    "hotel_payment_schedule",
    {
      select:
        "id,hotel_stay_id,label,payment_type,amount,status,due_date,paid_at,paid_on,paid_amount,settlement_id,payment_method",
      workspace_id: `eq.${stay.workspace_id}`,
      project_id: `eq.${stay.project_id}`,
      hotel_stay_id: `eq.${stay.id}`,
      order: "due_date.asc,id.asc",
    },
    signal,
  );
  const invoiceRequest = stay.roadbook_entry_id
    ? table<Record<string, unknown>>(
        "roadbook_entries_with_financials",
        {
          select: [
            "id",
            "financials_updated_at",
            ...HOTEL_INVOICE_FIELDS.map((key) => `${key}:details->${key}`),
          ].join(","),
          id: `eq.${stay.roadbook_entry_id}`,
          workspace_id: `eq.${stay.workspace_id}`,
          type: "eq.hotel",
          order: "id.asc",
        },
        signal,
      )
        .then((rows) => {
          if (
            rows.length > 1 ||
            (rows[0] && rows[0].id !== stay.roadbook_entry_id)
          )
            throw new ReadError("CONTRACT");
          return projectHotelInvoice(rows[0] ?? null);
        })
        .catch((error) => {
          if (signal.aborted) throw error;
          return projectHotelInvoice(null);
        })
    : Promise.resolve(projectHotelInvoice(null));
  const [payments, invoice] = await Promise.all([
    paymentsRequest,
    invoiceRequest,
  ]);
  return { commitment: commitments[0]!, payments, invoice };
}
export async function loadHotelRooming(stay: HotelStay, signal: AbortSignal) {
  if (!stay.roadbook_entry_id) throw new ReadError("NOT_AVAILABLE");
  const entries = await table<{
    id: string;
    tour_day_id: string | null;
    event_date_id: string | null;
  }>(
    "roadbook_entries",
    {
      select: "id,tour_day_id,event_date_id",
      workspace_id: `eq.${stay.workspace_id}`,
      id: `eq.${stay.roadbook_entry_id}`,
      type: "eq.hotel",
      order: "id.asc",
    },
    signal,
  );
  const entry = entries[0];
  if (!entry) throw new ReadError("FORBIDDEN");
  let dayId = entry.tour_day_id;
  if (!dayId && entry.event_date_id) {
    const days = await table<{ id: string }>(
      "tour_days",
      {
        select: "id",
        workspace_id: `eq.${stay.workspace_id}`,
        project_id: `eq.${stay.project_id}`,
        event_date_id: `eq.${entry.event_date_id}`,
        order: "id.asc",
      },
      signal,
    );
    if (days.length === 1) dayId = days[0]!.id;
  }
  if (!dayId) throw new ReadError("NOT_AVAILABLE");
  const result = await rpc<{
    code: string;
    entry_id: string;
    booking_reference: string | null;
    rooms: Array<{
      id: string;
      room_id: string;
      room_type: string;
      room_number: string | null;
      name: string;
    }>;
  }>(
    "get_roadbook_operational_rooming",
    {
      p_workspace_id: stay.workspace_id,
      p_project_id: stay.project_id,
      p_tour_day_id: dayId,
      p_entry_id: entry.id,
    },
    signal,
  );
  if (result.code !== "OK") throw new ReadError("FORBIDDEN");
  if (result.entry_id !== entry.id || !Array.isArray(result.rooms))
    throw new ReadError("CONTRACT");
  const guests: RoomingGuest[] = result.rooms.map((r) => {
    if (
      typeof r.id !== "string" ||
      typeof r.room_id !== "string" ||
      typeof r.name !== "string"
    )
      throw new ReadError("CONTRACT");
    return {
      id: r.id,
      roomId: r.room_id,
      roomType: r.room_type,
      roomNumber: r.room_number,
      name: r.name.trim() || "Nom non renseigné",
    };
  });
  return { guests, reference: result.booking_reference };
}
