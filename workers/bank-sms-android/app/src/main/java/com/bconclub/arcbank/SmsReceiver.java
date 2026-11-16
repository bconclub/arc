package com.bconclub.arcbank;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;

/** Every incoming SMS: if it is a bank transaction, queue it and send right away. */
public class SmsReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        SmsMessage[] parts = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (parts == null || parts.length == 0) return;
        // A long SMS arrives in parts; join them.
        StringBuilder body = new StringBuilder();
        for (SmsMessage p : parts) body.append(p.getMessageBody());
        String sender = parts[0].getOriginatingAddress();
        long ts = parts[0].getTimestampMillis();
        if (!Bank.looksLikeBankTxn(sender, body.toString())) return;

        Bank.enqueue(context, sender, body.toString(), ts);
        final PendingResult pr = goAsync();
        final Context app = context.getApplicationContext();
        new Thread(() -> { try { Bank.flush(app); } finally { pr.finish(); } }).start();
    }
}
