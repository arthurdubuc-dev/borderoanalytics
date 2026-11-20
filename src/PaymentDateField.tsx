import React from "react";
import { Platform, Pressable, View, Keyboard } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import {
  paymentCalendarValue,
  paymentCalendarMaximum,
  paymentCalendarSelection,
} from "./paymentCalendar";
import { Txt, Icon, useTheme } from "./ui";
export function PaymentDateField({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const c = useTheme();
  const selected = paymentCalendarValue(value),
    maximum = paymentCalendarMaximum();
  function choose(date: Date) {
    const next = paymentCalendarSelection(date);
    if (next) onChange(next);
  }
  return (
    <View style={{ gap: 7 }}>
      <Txt style={{ fontSize: 13, fontWeight: "600" }}>
        Date réelle du paiement
      </Txt>
      {Platform.OS === "ios" ? (
        <View
          style={{
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 14,
            backgroundColor: c.surface,
            padding: 10,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <DateTimePicker
            accessibilityLabel="Date réelle du paiement. Ouvrir le calendrier"
            value={selected}
            mode="date"
            display="compact"
            locale="fr-FR"
            timeZoneName="Europe/Paris"
            maximumDate={maximum}
            disabled={disabled}
            themeVariant={c.bg === "#0B0D10" ? "dark" : "light"}
            accentColor={c.text}
            style={{ height: 40, width: "100%" }}
            onValueChange={(_event, date) => choose(date)}
          />
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            "Ouvrir le calendrier. Date du paiement : " + value
          }
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => {
            Keyboard.dismiss();
            DateTimePickerAndroid.open({
              value: selected,
              mode: "date",
              display: "calendar",
              timeZoneName: "Europe/Paris",
              maximumDate: maximum,
              positiveButton: { label: "Choisir" },
              negativeButton: { label: "Annuler" },
              onValueChange: (_event, date) => choose(date),
            });
          }}
          style={{
            minHeight: 54,
            padding: 15,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: 14,
            backgroundColor: c.surface,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <Txt>{value}</Txt>
          <Icon name="calendar-outline" />
        </Pressable>
      )}
      <Txt muted style={{ fontSize: 11 }}>
        Touche la date pour ouvrir le calendrier.
      </Txt>
    </View>
  );
}
