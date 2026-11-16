package com.bconclub.arcbank;

import android.content.Context;
import android.content.SharedPreferences;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * Decides on the phone which SMS may leave it, keeps a queue of the ones not yet
 * delivered, and posts them to ARC.
 *
 * Only messages from a business sender header (e.g. VM-HDFCBK, never a phone
 * number) that carry an amount and a credit/debit word go out. Anything with an
 * OTP or verification code is dropped here and never sent.
 */
final class Bank {
    private Bank() {}

    private static final Pattern OTP = Pattern.compile("(?i)(is\\s+(your|the)\\s+(otp|one[\\s-]?time\\s+password|verification\\s+code)|\\botp\\s*(is|for|:)|verification\\s+code\\s*(is|:)|one[\\s-]?time\\s+password\\s*(is|:))");
    private static final Pattern AMOUNT = Pattern.compile("(?i)(rs\\.?|inr|₹)\\s*[\\d,]+");
    private static final Pattern MOVE = Pattern.compile("(?i)\\b(credited|debited|deposited|received|spent|sent|withdrawn|paid|purchase|refund)\\b");
    private static final Pattern PERSON = Pattern.compile("^\\+?\\d[\\d\\s-]{6,}$");

    static boolean looksLikeBankTxn(String sender, String body) {
        if (sender == null || body == null) return false;
        if (PERSON.matcher(sender.trim()).matches()) return false; // personal SMS
        if (OTP.matcher(body).find()) return false;
        return AMOUNT.matcher(body).find() && MOVE.matcher(body).find();
    }

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("arcbank", Context.MODE_PRIVATE);
    }

    static synchronized void enqueue(Context c, String sender, String body, long ts) {
        try {
            JSONArray q = new JSONArray(prefs(c).getString("queue", "[]"));
            q.put(new JSONObject().put("sender", sender).put("body", body).put("ts", ts));
            prefs(c).edit().putString("queue", q.toString()).apply();
        } catch (Exception ignored) {}
    }

    static synchronized int pending(Context c) {
        try { return new JSONArray(prefs(c).getString("queue", "[]")).length(); } catch (Exception e) { return 0; }
    }

    static void setLast(Context c, String s) { prefs(c).edit().putString("last", s).apply(); }
    static String last(Context c) { return prefs(c).getString("last", "Not sent yet"); }

    /** Sends the queue in batches of 200. Returns a short human result. Blocking: call off the main thread. */
    static synchronized String flush(Context c) {
        try {
            JSONArray q = new JSONArray(prefs(c).getString("queue", "[]"));
            if (q.length() == 0) return "Nothing to send";
            int sent = 0, inserted = 0;
            while (sent < q.length()) {
                JSONArray batch = new JSONArray();
                for (int i = sent; i < Math.min(sent + 200, q.length()); i++) batch.put(q.get(i));
                JSONObject res = post(new JSONObject().put("device", android.os.Build.MODEL).put("messages", batch));
                inserted += res.optInt("inserted", 0);
                sent += batch.length();
                // Drop what has been delivered so a later failure doesn't resend it.
                JSONArray rest = new JSONArray();
                for (int i = sent; i < q.length(); i++) rest.put(q.get(i));
                prefs(c).edit().putString("queue", rest.toString()).apply();
            }
            String r = "Sent " + sent + ", " + inserted + " new in ARC · " + new java.text.SimpleDateFormat("d MMM, h:mm a").format(new java.util.Date());
            setLast(c, r);
            return r;
        } catch (Exception e) {
            String r = "Send failed, will retry: " + e.getMessage();
            setLast(c, r);
            return r;
        }
    }

    private static JSONObject post(JSONObject payload) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(BuildConfig.ARC_URL).openConnection();
        h.setConnectTimeout(15000);
        h.setReadTimeout(30000);
        h.setRequestMethod("POST");
        h.setDoOutput(true);
        h.setRequestProperty("Content-Type", "application/json");
        h.setRequestProperty("Authorization", "Bearer " + BuildConfig.ARC_SECRET);
        try (OutputStream o = h.getOutputStream()) { o.write(payload.toString().getBytes(StandardCharsets.UTF_8)); }
        int code = h.getResponseCode();
        java.io.InputStream in = code < 400 ? h.getInputStream() : h.getErrorStream();
        String txt = in == null ? "" : new String(in.readAllBytes(), StandardCharsets.UTF_8);
        if (code >= 400) throw new Exception("ARC " + code + " " + txt);
        return new JSONObject(txt);
    }
}
