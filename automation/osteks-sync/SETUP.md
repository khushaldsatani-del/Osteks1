# Daily automatic import – setup

Every morning at **05:00** a small script on a Windows machine takes the newest
`OSTEKS-Auswertungen-*.xlsx` from `\\cgn-fs01\Auswertungen` and sends it to the
Osteks app. If the file has not been updated yet, it tries again every 30
minutes until **08:00**. The result shows up in **Production View → Upload →
Upload history** as *Automatic · Saved / No new data / Failed*.

```
\\cgn-fs01\Auswertungen  ──▶  osteks-sync.ps1 (Task Scheduler, 05:00)  ──HTTPS + key──▶  osteks1 on Cloud Run  ──▶  dashboard
```

You need: admin rights on that Windows machine once (or IT), access to the
Google Cloud console for the `osteks1` service, and about 30 minutes.

---

## Step 1 – Create the secret key (any Windows PC)

Open **PowerShell** and run:

```powershell
$b = New-Object byte[] 48; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b).TrimEnd('=').Replace('+','-').Replace('/','_')
```

It prints a long random text – that is the key. Keep it somewhere safe (e.g.
your password manager). It goes into exactly two places: the server (Step 2)
and the settings file on the remote machine (Step 4). Never into chat, email
or Git.

## Step 2 – Give the key to the server (Google Cloud console)

1. Open **Google Cloud console → Cloud Run → `osteks1`** (region `europe-west1`).
2. **Edit & deploy new revision → Variables & secrets**.
3. Add a variable:
   - Name: `PRODUCTION_IMPORT_KEY`
   - Value: the key from Step 1
   *(Better: store it in **Secret Manager** and choose "Reference a secret" –
   then the key is not visible to everyone who can view the service.)*
4. **Deploy**.
5. Note the service **URL** shown at the top of the `osteks1` page, e.g.
   `https://osteks1-abc123-ew.a.run.app` – the script needs it.

Later deploys (pushes to `main`) keep this variable – you only set it once.

> The new code must be deployed too: commit and push the current changes to
> `main` (Cloud Build deploys `osteks1` automatically). Without it the server
> doesn't know the `/api/production/import/auto` address yet.

Check: open `<URL>/api/health` in a browser – it should answer with `"ok":true` in it.

## Step 3 – Choose the Windows machine and user

The script must run on a machine that

- **is switched on at 05:00** (a server is ideal; a laptop that sleeps is not),
- **can open `\\cgn-fs01\Auswertungen`** – test: type the path into Explorer,
- **can reach the internet** over HTTPS (port 443) – test: open the URL from
  Step 2 + `/api/health` in a browser on that machine.

It runs as a **Windows user that can read the share** – your normal domain
login works. Ask IT for a dedicated account (e.g. `svc-osteks-sync`) with a
password that does not expire: when the password of the account in the task
changes, the task stops running until it's updated there too.

> The built-in "SYSTEM" account usually can **not** open network shares – don't
> use it for this task.

## Step 4 – Install the script (on that machine)

1. Create the folder **`C:\OsteksSync`**.
2. Copy into it from this repository folder (`automation/osteks-sync/`):
   - `osteks-sync.ps1`
   - `osteks-sync.config.example.json` → **rename the copy** to
     `osteks-sync.config.json`
3. Open `osteks-sync.config.json` in Notepad and fill in:

   ```json
   {
     "sourceFolder": "\\\\cgn-fs01\\Auswertungen",
     "filePattern": "OSTEKS-Auswertungen-*.xlsx",
     "serverUrl": "https://osteks1-abc123-ew.a.run.app",
     "importKey": "the key from Step 1",
     "retryEveryMinutes": 30,
     "giveUpAt": "08:00"
   }
   ```

   - `serverUrl`: the URL from Step 2, **without** a slash at the end.
   - In JSON every `\` is written twice – keep `\\\\cgn-fs01\\Auswertungen`
     exactly like this.

## Step 5 – Test it by hand

Open **PowerShell** (as the user from Step 3) and run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File C:\OsteksSync\osteks-sync.ps1 -Once
```

`-Once` = a single attempt, no waiting. You should see something like:

```
found OSTEKS-Auswertungen-2026.xlsx (changed 21.10.2026 04:12, 125 KB)
IMPORTED - 22 new / 0 changed values, data up to 2026-10-21
end (exit code 0)
```

or `no new data this morning …` if that file was already imported. Then open
the app → **Production View → Upload → Upload history**: the newest row says
**Automatic**.

If it doesn't work, see **Troubleshooting** below – the same lines are in
`C:\OsteksSync\osteks-sync.log`.

## Step 6 – Schedule it (Task Scheduler)

1. Start → **Task Scheduler** → right side **Create Task…** (not "Basic Task").
2. **General**
   - Name: `Osteks Auswertungen Sync`
   - **Change User or Group…** → the user from Step 3
   - ✅ **Run whether user is logged on or not**
   - ☐ *Do not store password* – leave **unticked** (needed for the network share)
3. **Triggers** → New… → **Daily**, start **05:00:00**, ✅ Enabled → OK
4. **Actions** → New… → Start a program
   - Program/script: `powershell.exe`
   - Add arguments: `-NoProfile -ExecutionPolicy Bypass -File "C:\OsteksSync\osteks-sync.ps1"`
   - Start in: `C:\OsteksSync`
5. **Conditions**
   - ✅ **Wake the computer to run this task**
   - ☐ *Start the task only if the computer is on AC power* – untick
6. **Settings**
   - ✅ **Run task as soon as possible after a scheduled start is missed**
   - ✅ **Stop the task if it runs longer than: 4 hours**
7. **OK** → enter the user's password.
8. Test: right-click the task → **Run**. After a minute, **Last Run Result**
   should be `The operation completed successfully. (0x0)` and the log has a new
   entry.

`-ExecutionPolicy Bypass` applies only to this one script – no Windows setting
is changed.

## Step 7 – Check the first mornings

Each morning after 08:00, look at **Upload history** (or the log):

| History shows | Meaning | Do |
|---|---|---|
| Automatic · **Saved** | new data imported | nothing |
| Automatic · **No new data** | the file on the share wasn't updated until 08:00 (normal on weekends/holidays) | nothing – unless it happens on a working day |
| Automatic · **Failed** + reason | the file could not be read | check the file on the share |
| *no Automatic row at all* | the script didn't run or couldn't reach the server/share | see the log and Task Scheduler's *Last Run Result* |

---

## Troubleshooting

**Last Run Result** in Task Scheduler is the script's exit code:

| Code | Log says | Fix |
|---|---|---|
| `0x0` | IMPORTED / no new data | all good |
| `0x2` | server could not read the file | the Excel on the share is damaged or not an `.xlsx` – open it in Excel and check |
| `0x3` | REFUSED by the server (401/503) | `importKey` doesn't match `PRODUCTION_IMPORT_KEY` on Cloud Run (401), or the variable isn't set (503) |
| `0x4` | unexpected answer / connection error | the machine can't reach the server URL – check the URL, internet access, company proxy/firewall |
| `0x5` | share not reachable / no file | the task user can't open `\\cgn-fs01\Auswertungen`, or no `OSTEKS-Auswertungen-*.xlsx` in it |
| `0x9` | setting … is empty or still the example value | fill in `osteks-sync.config.json` (Step 4) |
| `0x41301` | – | the task is still running (it waits up to 08:00) |

**Change the key:** make a new one (Step 1), put it on Cloud Run (Step 2),
then in `osteks-sync.config.json` (Step 4). Until both match, runs end with `0x3`.

**Change time / retries:** the start time is the trigger in Task Scheduler;
`retryEveryMinutes` and `giveUpAt` are in the settings file.

**Import by hand meanwhile:** Production View → Upload still works as before
(shows as *Manual* in the history). Importing the same file twice never
changes anything.
