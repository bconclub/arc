package com.bconclub.arcbank;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;

/**
 * One screen: what the app is allowed to do, how many bank messages it found,
 * the last send result, and the found messages so they can be checked by eye.
 */
public class MainActivity extends Activity {
    private TextView status, list;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        int pad = (int) (18 * getResources().getDisplayMetrics().density);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad * 2, pad, pad);

        TextView title = new TextView(this);
        title.setText("ARC Bank");
        title.setTextSize(24);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        root.addView(title);

        TextView sub = new TextView(this);
        sub.setText("Reads bank SMS (credits and spends) and sends them to ARC. OTPs and personal messages never leave the phone.");
        sub.setAlpha(0.7f);
        sub.setPadding(0, pad / 3, 0, pad);
        root.addView(sub);

        status = new TextView(this);
        status.setTextSize(15);
        root.addView(status);

        Button scan = new Button(this);
        scan.setText("Send bank SMS since 1 Oct");
        scan.setOnClickListener(v -> backfill());
        root.addView(scan);

        Button open = new Button(this);
        open.setText("Open ARC Bank page");
        open.setOnClickListener(v -> startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://arc.bconclub.com/dashboard/ops/bank"))));
        root.addView(open);

        list = new TextView(this);
        list.setTextSize(12);
        list.setTypeface(Typeface.MONOSPACE);
        list.setPadding(0, pad, 0, 0);
        root.addView(list);

        ScrollView sv = new ScrollView(this);
        sv.addView(root);
        setContentView(sv);

        if (checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.READ_SMS, Manifest.permission.RECEIVE_SMS}, 1);
        }
        refresh();
        // Anything left over from a failed send goes now.
        new Thread(() -> { if (Bank.pending(this) > 0) { Bank.flush(this); runOnUiThread(this::refresh); } }).start();
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] p, int[] r) { refresh(); }

    private void refresh() {
        boolean ok = checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
                && checkSelfPermission(Manifest.permission.RECEIVE_SMS) == PackageManager.PERMISSION_GRANTED;
        status.setText((ok ? "● Listening for bank SMS" : "● SMS permission not given. Allow it in Settings › Apps › ARC Bank.")
                + "\nWaiting to send: " + Bank.pending(this)
                + "\nLast: " + Bank.last(this));
        status.setTextColor(ok ? Color.rgb(34, 160, 90) : Color.rgb(220, 90, 40));
    }

    private void backfill() {
        if (checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) { refresh(); return; }
        status.setText("Reading SMS…");
        new Thread(() -> {
            Calendar from = Calendar.getInstance();
            from.set(2026, Calendar.OCTOBER, 1, 0, 0, 0);
            StringBuilder shown = new StringBuilder();
            int found = 0;
            SimpleDateFormat f = new SimpleDateFormat("d MMM h:mm a");
            try (Cursor c = getContentResolver().query(Uri.parse("content://sms/inbox"),
                    new String[]{"address", "body", "date"}, "date >= ?",
                    new String[]{String.valueOf(from.getTimeInMillis())}, "date DESC")) {
                while (c != null && c.moveToNext()) {
                    String a = c.getString(0), body = c.getString(1);
                    long ts = c.getLong(2);
                    if (!Bank.looksLikeBankTxn(a, body)) continue;
                    Bank.enqueue(this, a, body, ts);
                    if (found < 60) shown.append(f.format(new Date(ts))).append("  ").append(a).append("\n")
                            .append(body.length() > 110 ? body.substring(0, 110) + "…" : body).append("\n\n");
                    found++;
                }
            } catch (Exception e) {
                shown.append("Could not read SMS: ").append(e.getMessage());
            }
            final int n = found;
            final String head = "Found " + n + " bank messages since 1 Oct" + (n > 60 ? " (latest 60 shown)" : "") + "\n\n";
            runOnUiThread(() -> { list.setText(head + shown); status.setText("Sending " + n + " to ARC…"); });
            Bank.flush(this);
            runOnUiThread(this::refresh);
        }).start();
    }
}
