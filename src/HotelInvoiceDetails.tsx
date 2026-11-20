import React from "react";
import { View } from "react-native";
import { Txt, Notice, useTheme } from "./ui";
import { exact } from "./domain";
import type { HotelInvoice } from "./hotelInvoice";
const roomNames: Record<string, string> = {
  SINGLE: "Single",
  DOUBLE: "Double",
  TWIN: "Twin",
  TRIPLE: "Triple",
  SUITE: "Suite",
  SUPERIOR: "Supérieure",
  OTHER: "Autre",
};
export function HotelInvoiceDetails({
  invoice,
}: {
  invoice: HotelInvoice | undefined;
}) {
  const c = useTheme(),
    s = invoice?.summary,
    d = invoice?.details;
  if (!s || !d)
    return (
      <Notice warning>
        {invoice?.warning ??
          "Détail facture indisponible avec les informations accessibles."}
      </Notice>
    );
  const row = (label: string, value: number, bold = false) => (
    <View
      key={label}
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 12,
        paddingVertical: 7,
      }}
    >
      <Txt style={{ flex: 1, fontWeight: bold ? "700" : "400" }}>{label}</Txt>
      <Txt style={{ fontWeight: bold ? "700" : "500" }}>
        {exact(value, true)}
      </Txt>
    </View>
  );
  const extras = [
    [
      "Petits-déjeuners",
      s.breakfastTTC,
      d.has_breakfast,
      d.breakfast_ttc_per_person,
      d.breakfast_people || d.occupants,
    ],
    [
      "Déjeuners",
      s.lunchTTC,
      d.has_lunch,
      d.lunch_ttc_per_person,
      d.lunch_people || d.occupants,
    ],
    [
      "Dîners",
      s.dinnerTTC,
      d.has_dinner,
      d.dinner_ttc_per_person,
      d.dinner_people || d.occupants,
    ],
    [
      "Parking",
      s.parkingTTC,
      d.has_parking,
      d.parking_ttc_per_unit,
      d.parking_qty,
    ],
    [
      "Parking bus",
      s.busParkingTTC,
      d.has_bus_parking,
      d.bus_parking_ttc,
      d.bus_parking_spots,
    ],
    [
      "Arrivée anticipée",
      s.earlyCheckinTTC,
      d.has_early_checkin,
      d.early_checkin_ttc,
      d.early_checkin_qty,
    ],
    [
      "Départ tardif",
      s.lateCheckoutTTC,
      d.has_late_checkout,
      d.late_checkout_ttc,
      d.late_checkout_qty,
    ],
  ] as const;
  const vat = Math.round((s.totalTTC - s.totalHT) * 100) / 100;
  return (
    <View style={{ gap: 12 }}>
      <Txt muted style={{ fontSize: 12 }}>
        {invoice.nights} nuitée{invoice.nights === 1 ? "" : "s"} · montants TTC
        enregistrés dans Bordero
      </Txt>
      {row("Chambres · total TTC", s.roomsTTC, true)}
      {d.room_rates.map((rate, i) => (
        <View
          key={rate.id || String(i)}
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: c.secondary,
            gap: 3,
          }}
        >
          <Txt style={{ fontWeight: "600" }}>
            {roomNames[rate.room_type] ?? rate.room_type} · {rate.qty} chambre
            {rate.qty === 1 ? "" : "s"}
          </Txt>
          <Txt muted style={{ fontSize: 13 }}>
            {rate.is_comped
              ? "Offerte"
              : `Prix unitaire TTC : ${exact(rate.price_ttc_per_room, true)} · TVA ${rate.vat_rate} %`}
          </Txt>
        </View>
      ))}
      {extras
        .filter(([, , enabled]) => enabled)
        .map(([label, total, , unit, quantity]) => (
          <View key={label}>
            {row(label, total, true)}
            <Txt muted style={{ fontSize: 12 }}>
              Prix unitaire TTC : {exact(unit ?? null, true)}
              {quantity !== undefined ? ` · quantité : ${quantity}` : ""}
            </Txt>
          </View>
        ))}
      {!d.has_breakfast && (
        <Txt muted style={{ fontSize: 12 }}>
          Petits-déjeuners non renseignés séparément.
        </Txt>
      )}
      <View style={{ height: 1, backgroundColor: c.line }} />
      {row("Taxe de séjour", s.cityTax)}
      {row("TVA comprise", vat)}
      {row(
        "Total taxes comprises",
        Math.round((vat + s.cityTax) * 100) / 100,
        true,
      )}
      <Txt muted style={{ fontSize: 11 }}>
        La TVA est déjà comprise dans les postes TTC. Le total des taxes n’est
        pas à ajouter une seconde fois.
      </Txt>
      {row("Total facture TTC", s.totalTTC, true)}
    </View>
  );
}
