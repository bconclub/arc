package com.bconclub.arcbank;

import android.Manifest;
import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.net.Uri;

/**
 * Once a day, with internet: re-read the last two days of bank SMS and send them.
 * Catches anything the live listener missed (phone off, app killed by battery
 * saver, no signal). ARC drops duplicates, so re-sending is harmless.
 */
public class DailyJob extends JobService {
    static final int ID = 7301;

    static void schedule(Context c) {
        JobScheduler js = c.getSystemService(JobScheduler.class);
        if (js == null || js.getPendingJob(ID) != null) return;
        js.schedule(new JobInfo.Builder(ID, new ComponentName(c, DailyJob.class))
                .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
                .setPeriodic(24L * 60 * 60 * 1000)
                .setPersisted(true)
                .build());
    }

    @Override
    public boolean onStartJob(JobParameters params) {
        new Thread(() -> {
            if (checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED) {
                long since = System.currentTimeMillis() - 2L * 24 * 60 * 60 * 1000;
                try (Cursor c = getContentResolver().query(Uri.parse("content://sms/inbox"),
                        new String[]{"address", "body", "date"}, "date >= ?", new String[]{String.valueOf(since)}, "date ASC")) {
                    while (c != null && c.moveToNext()) {
                        if (Bank.looksLikeBankTxn(c.getString(0), c.getString(1))) Bank.enqueue(this, c.getString(0), c.getString(1), c.getLong(2));
                    }
                } catch (Exception ignored) {}
            }
            Bank.flush(this);
            jobFinished(params, Bank.pending(this) > 0);
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters params) { return true; }
}
