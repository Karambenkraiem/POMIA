# POMIA — Feature Guide

POMIA (Plateforme des Opérations, Maintenance, Information et Analyse) is an operations platform for power plants and industrial sites. This guide describes every feature, who can use it, and how it fits into the daily workflow of a plant.

> All data in the public demo is fictional.

---

## 1. Access, accounts and roles

**Sign-in**
- Users sign in with a staff ID (*matricule*) and a password.
- Sessions last 12 hours.
- Passwords are stored as bcrypt hashes.
- Users can change their own password and update their name from the **Profile** page.
- A **guest quick-access** account gives read-only access for demonstrations.
- In demo mode, the login page shows a **quick-access panel**: one click signs in with any demo profile.

**Roles**

| Role | Typical use |
|---|---|
| Operator (*opérateur*) | Operator readings, team messaging, reading shift information |
| Unit supervisor (*chef de bloc*) | Turbine/generator readings every 2 hours, validation of the unit log |
| Shift supervisor (*chef de quart*) | Shift management, incidents, validation, cancellations, shift instructions |
| Plant manager (*chef d'exploitation*) | Plant-level oversight, test configuration, unlocking records, administration |
| Plant chief (*chef centrale*) | Access to shift instructions and support requests |
| Maintenance chief (*chef maintenance*) | Opening support requests |
| Director (*directeur*) | Read access to analysis and reports |
| MD Center assistant (*md_center_assistant*) | Answering support requests and proposing actions |
| Statistics (*statistique*) | Statistics page |
| Administrator (*admin*) | Full access, including user management |
| Guest (*invité*) | Read-only demonstration access |

Access rules are enforced on the **server**, not only in the interface. A user who lacks a permission cannot perform the action, even by calling the API directly.

---

## 2. Daily operations

### 2.1 Operating day (*Journée*)
- Each calendar day has one operating record.
- The day is split into **four shifts**: 00h–07h, 07h–14h, 14h–20h and 20h–00h.
- Each shift has an assigned shift supervisor, unit supervisor and operators.
- The day moves through a validation flow: **in progress → validated by unit supervisor → validated by shift supervisor → transmitted**.
- Records are locked once validated, unless an authorized user unlocks them for a correction.

### 2.2 Unit readings (*Relevés Chef de Bloc*)
Readings are recorded **every 2 hours** (00h, 02h … 22h) and cover:
- **Ambient and turbine data**: ambient temperature, pressure, humidity, turbine speed, line voltage, inlet guide vane position, gas temperature and pressure.
- **Generator**: active and reactive power, frequency, power factor, stator temperatures.
- **Lubrication oil**: tank level, pressures, bearing and reservoir temperatures.
- **Vibration**: bearing vibration levels, with a maximum value.
- **Exhaust**: thermocouple readings, average, and the **spread** (difference between the highest and lowest reading). The spread is computed by the server.
- **White metal**: bearing and turbine temperature readings.

A reading is locked after validation. Only an authorized user can unlock it for correction.

### 2.3 Operator readings (*Relevés Opérateur*)
- Readings every 2 hours in the same grid layout.
- Covers pumps, fans, gas and oil systems, gas and fire detectors, fuel stock, diesel generator data, energy meters and shift instructions.
- Records **particular instructions** given during the shift.

### 2.4 Daily meters (*Compteurs journaliers*)
Counters recorded for each day, with values at 00h, 07h, 18h, 22h and 24h:
- Active and reactive energy, auxiliary consumption, gas and fuel consumption.
- Flame, shutdown and running hours.
- Start and stop counts.
- Daily energy split into peak, off-peak and night, with maximum power and the time it occurred.

### 2.5 Switching operations and incidents (*Manœuvres & Incidents*)
- Chronological logbook of switching operations and incidents, in two tabs.
- Operation descriptions can be chosen from a list of standard phrases (for example *Ordre de démarrage*, *Couplage de groupe et 20 MW*, *Baisse de charge à PMC*).
- Incidents can only be recorded by shift supervisors or administrators.
- A badge on the day shows how many incidents were logged.

### 2.6 Repetitive alarms (*Alarmes répétitives*)
- Alarm list for the day with tag, description, equipment concerned and date of first occurrence.
- Sortable columns, and inline editing.
- Alarms from the previous day can be carried forward automatically.

### 2.7 Work orders (*Ordres de travaux*)
- Work orders with a number, equipment reference, description, dates and status.
- Types: corrective, systematic or preventive maintenance.
- Disciplines: mechanical, electrical, instrumentation, civil or other.
- Statuses: in progress, completed, postponed or cancelled.

### 2.8 Service requests and defective equipment
- **Service requests** (*Demandes de service*) with a number and urgency level.
- **Defective equipment** (*Matériels défectueux*) by zone (site, gas turbine, generator, auxiliaries), with status (open, in progress, closed) and comments.

---

## 3. Periodic tests (*Essais*)

Periodic tests are configured once and then run automatically every day.

**Configuration (plant manager and administrator)**
- Test name.
- Frequency: daily, weekly (on chosen weekdays), monthly, six-monthly or yearly.
- Readings to record, in order. Each reading can be:
  - a numeric **value** (with a unit),
  - a **potentiometer** (0–100%),
  - a **level** reading,
  - a **selection** from a list you define (for example *OK / Fault*).
- Readings can be reordered.

**Execution**
- When a day is created, the tests due that day are created automatically, including for days already created before a test was added.
- The test appears on the dashboard as an alert, with a link to the day's test page.
- Users fill in the values. Shift supervisors can cancel a test, but must give a reason.
- Once a test is marked **done**, its values are locked. Only the plant manager can unlock them.

**History**
- Each test has its own page with its past occurrences, sorted by date.
- Opening an occurrence shows the values recorded.
- The date picker highlights days on which a test took place.

---

## 4. Shift instructions (*Consignes*)

- A single list of instructions, sorted from most recent to oldest. It is not tied to a particular day.
- Created, edited and deleted by the plant manager, shift supervisors and administrators.
- Each instruction can be marked **completed**. A completed instruction is greyed out and can be **relaunched**, which gives it a new date and moves it back to the top of the list.
- Visible to operators, unit supervisors, shift supervisors, the plant chief, the plant manager and administrators.

---

## 5. Support requests (*Réclamations & Assistance*)

A ticketing workflow between the site and the MD Center assistant.

- **Opening a request**: plant manager, maintenance chief, plant chief, MD Center assistant or administrator. Each request has a title, a description and an optional image or PDF attachment.
- **Visibility**: all signed-in users except guests can see every request and its discussion.
- **Discussion**: the requester and the MD Center assistant exchange replies, with attachments, until the issue is resolved. The first reply from the assistant changes the status to *in progress*.
- **Closing**: the requester, the assistant or an administrator closes the request. A **closing reason is mandatory**. The reason is shown on the closed request.
- **Search**: filter requests by any keyword in the title, description or requester name.
- **Attachments**: images and PDFs up to 8 MB, on the request itself or on any reply.

---

## 6. Internal messaging (*Messagerie*)

- A floating chat button is available on every page, with a counter for unread messages.
- One-to-one conversations between any two signed-in users, except guests.
- Each conversation shows the last message and the unread count, and conversations are sorted by most recent message.
- Messages can include **photos, videos or PDFs** (up to 20 MB). On a phone, you can take a photo or record a video directly from the chat.
- Attachments are only accessible to the sender and the recipient.
- Messages refresh automatically.

---

## 7. Dashboard

- Overview of the current day: shift status, last reading, key indicators and turbine status.
- Configurable metric cards, chosen and arranged by each user.
- An amber alert lists the tests due today, with a link to the test page.
- Date navigation to view any previous day.

---

## 8. Analysis, reports and views

- **Analysis & Diagnostic** (*Analyse & Diagnostic*): trend charts for a chosen parameter over a period, for shift supervisors, the plant manager, the director and administrators.
- **Manœuvre search** (*Recherche manœuvres*): find past switching operations by keyword and date range.
- **Daily report** (*Rapport journalier*): a complete summary of the day, designed to print.
- **Daily sheets** (*Visualisation*): operator and unit supervisor readings laid out as printable sheets, with charts for each parameter.
- **Statistics** (*Statistique*): summary statistics, for the statistics role and administrators.

---

## 9. Administration

Visible to administrators, and to the plant manager where stated.

- **Users** (administrator): create accounts, assign roles, deactivate accounts. Accounts are never deleted, only deactivated, which keeps the history intact.
- **Alarm thresholds** (*Seuils d'alerte*): set minimum and maximum limits per monitored parameter (for example vibration, gas pressure, exhaust temperature spread).
- **Activity log** (*Journal d'activité*) (administrator and plant manager): a record of every change made in the application: who did it, which action, when and from which address.
- **Test configuration** (*Essais (paramétrage)*) (administrator and plant manager): create and edit periodic tests.
- **Demo mode** (administrator): turn the quick-access login panel on or off.

---

## 10. Mobile, desktop and offline

- **Responsive design**: works on desktop, tablet and phone.
- **Installable web app**: can be added to the home screen of a phone or computer.
- **Native apps**: Android and iOS apps built from the same code.
- **Updates**: the Android app notifies users when a new version is available.
- **Dark and light themes**, with a switch in the menu.
- **Collapsible menu** on desktop, and a slide-out menu on phones.

---

## 11. Security and traceability

- Passwords stored as bcrypt hashes.
- Sessions use signed tokens with a 12-hour lifetime.
- Permissions are checked by role on every server request.
- Every change is recorded in the activity log.
- Attachments are checked by type and size before they are stored.
- Data is stored in PostgreSQL.
- Secrets (database password, token signing key) are provided through environment variables and are never committed to the repository.

---

## 12. Deployment

- Packaged with **Docker Compose**: database, backend API and frontend, each in its own container.
- Production setup behind a reverse proxy with HTTPS.
- Continuous deployment through GitHub Actions: each push to the main branch rebuilds and redeploys the application.
- The Android APK is built and signed automatically in the same pipeline.

See the setup instructions in [README.md](README.md).
