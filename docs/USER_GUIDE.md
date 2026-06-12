# Welcome to Docketly

*A getting-started guide for paralegals, legal assistants, and attorneys.*

---

## 1. What Docketly does for you

Docketly watches the stream of court notices that arrives at your firm —
hearing notices, 341 meetings, discharge orders, and the rest — and reads
each one the way a paralegal would. When a notice is routine and clear, it
matches the notice to the right case and sends your firm's standard email to
the right people, automatically, within a minute of arrival. When a notice is
unclear in any way, Docketly never guesses: it sets the notice aside and
waits for you to look at it first.

## 2. Your first day

### Signing in — no password to remember

1. Go to your firm's Docketly page. You'll see a sign-in card.
2. Type your work email and click **Send magic link**.
3. Open your email, click the link, and you're in. That's the whole thing.

There is no password to create, forget, or reset. Any time you're signed
out, request a fresh link the same way. When you're done for the day, the
**Sign out** button is at the bottom of the left-hand menu, under your name.

### The five pages in the left-hand menu

- **Notices** — every notice the firm has received, newest first. Think of
  it as the master mail log.
- **Review** — the short list of notices waiting for your judgment. This is
  the only inbox you still need to read.
- **Automations** — your firm's rules: "when this kind of notice arrives,
  send this letter to these people."
- **Runs** — the send log. Every email Docketly has sent (or tried to send),
  with the time, the recipient, and the result.
- **Evals** — a report card on how accurately Docketly has been reading
  notices. Most days you won't need it; your managing attorney may check it
  now and then.

You'll also notice a small number on the **Review** line — that's how many
notices are waiting for you. No number means nothing is waiting.

## 3. Setting up your firm's rules

A rule is one sentence of office policy, written down once: *"When a hearing
notice arrives, email the client our standard hearing letter."* Let's create
exactly that one.

Open **Automations** and click **New automation**. The form, top to bottom:

1. **Name** — what you'll call this rule in lists. Try
   *Hearing notice to client*.
2. The **Enabled** switch — leave it on. (Flipping it off later pauses the
   rule instantly without deleting it.)
3. **Notice type** — pick *Notice of Hearing* from the list. This is the
   kind of notice that wakes the rule up.
4. **Chapter filter** — leave as *Any chapter*, or narrow the rule to
   Chapter 7 or Chapter 13 matters only.
5. **Judge filter (initials)** — leave blank for any judge, or type a
   judge's initials to limit the rule to that courtroom.
6. **Recipients** — who gets the email. Click **Client** to send to the
   client on the matched case. (You could also click **Attorney**, or type a
   specific email address and press Enter — for a trustee or co-counsel, say.
   Each choice appears as a small chip; click the × on a chip to remove it.)
7. **Subject template** and **Body template** — your standard letter. Write
   it the way you'd write any client email, with one trick: blanks that fill
   themselves in.

### Blanks that fill themselves in

Wherever you'd normally stop and look something up, type a blank instead.
A blank is a word wrapped in double curly braces, like `{{client_name}}`.
When the rule sends a real email, Docketly fills each blank from the actual
case and notice. So this:

> Dear `{{client_name}}`,
>
> A hearing has been scheduled in your case `{{case_number}}` on
> `{{hearing_date}}` at `{{hearing_time}}`.

…goes out as:

> Dear Maria T. Alvarez,
>
> A hearing has been scheduled in your case 26-10342 on July 9, 2026 at
> 10:00 AM.

You never have to memorize the blanks. The panel on the right of the form
(labeled **Token reference** on screen) lists every blank you can use, with
a sample value next to each. And the **Preview** panel below it shows your
letter exactly as a client would receive it, filled in with a sample case,
updating as you type. If a blank looks wrong in the preview, fix it before
you save — what you see there is what clients will get.

8. Click **Create automation**. Your rule now appears in the list, switched
   on, ready for the next hearing notice.

To change a rule later, click its name. To pause it, flip its switch in the
**On** column — the pause takes effect immediately.

## 4. Your daily routine

Start your day in **Review**. If it says *"Nothing needs your attention."* —
that's a real answer, not a placeholder. Everything that arrived was clear,
matched, and handled. You're done here.

When something is waiting, each line shows you four things at a glance: when
the notice arrived, Docketly's best guess at what it is, how sure Docketly
was (as a percentage), and — under **Held because** — the exact reason it
was set aside. The reasons are plain: Docketly wasn't sure enough, or it
didn't recognize the notice type, or it couldn't match the case number to
one of your firm's cases. There's also a one-line note in Docketly's own
words explaining what it saw.

### Fixing and approving a held notice — under a minute

Click the notice. The screen splits in two: the **Source text** — the actual
notice, exactly as it arrived — on the left, and a short form on the right.

The form is already filled in with Docketly's best reading. Your job is not
to fill it out from scratch — it's to correct only what's wrong. Read the
notice on the left like you always would, then check the form: **Notice
type**, **Chapter**, **Case number**, **Judge initials**, **Hearing date &
time**. A smudged case number is the most common fix — type the real one.

Then click **Approve & run automations**. Two things happen: your
corrections become the official record of that notice, and any rules that
match it now send their letters — using *your* corrected facts, not the
original guess. Docketly also makes a note of who approved it and when, so
the file always shows the human decision.

If the case number you typed doesn't match any case at your firm, Docketly
will tell you so and send nothing — check for a typo, or check whether the
case exists in your records.

If the notice is junk — a misdirected fax, a blank scan — click **Mark
failed** instead. Nothing is sent, the notice leaves your queue, and it
stays in the Notices log for the record.

### Then a quick scan, and you're done

- Glance at **Notices**. Healthy traffic looks like a column of green
  *classified* badges. Amber *needs review* means it's waiting in Review;
  blue *classifying* means Docketly is still reading it (give it a minute);
  red *failed* is rare — see section 6.
- Glance at **Runs** to see what went out today. More on reading it below.

## 5. When a notice arrives on paper or by email

Not everything comes through the court feed. A notice handed to you at
counsel table, or attached to an email, joins the same flow in one step:
save or scan it as a PDF, open **Notices**, click **Upload PDF**, and choose
the file.

From there it's treated exactly like a notice from the court: Docketly reads
it, matches it, and either handles it or sets it aside for Review. If the
scan is too rough to read, it simply goes to Review, where you can open the
original PDF (there's an **Open PDF** link next to the notice text) and read
it yourself.

## 6. How to check that a client was told

**Runs** is the firm's send log, and your proof. Every line is one email one
rule sent about one notice: the time, the rule's name, which notice and case
it concerned, who it went to, and the result.

- A green **sent** badge means delivered to the email service, with a
  delivery receipt code in the last column.
- A red **failed** badge means that one email did not go out. The reason is
  written right there on the line — most often an email address that
  doesn't work. **One failed line never stops the others**: if a notice
  was supposed to go to both the client and the attorney and one address was
  bad, the other email still went out normally.

When you see a failed line: read the reason, fix the root cause (usually a
client's email address in your case records, or an address typed into a
rule), and tell whoever sent the original notice context — then the client
can be contacted directly so nothing is missed. The failed line stays in the
log; that's deliberate, so there's always an honest record.

You can also see every email connected to one particular notice by opening
that notice in **Notices** — the list at the bottom of its page shows each
rule that acted on it.

## 7. Questions you might have

**What if Docketly gets something wrong?**
The whole system is built around that question. When Docketly isn't sure, it
doesn't act — it asks you, in Review. Nothing on an unclear notice goes out
until a person approves it. And every correction you make in Review actually
teaches the firm's report card (**Evals**), so accuracy is checked against
real, human-verified answers — not taken on faith.

**Can it send the same email twice by accident?**
No. Docketly keeps a permanent record of every rule-and-notice pairing it has
already acted on, and it is built so that the same notice can never trigger
the same rule twice — even if the court system delivers a duplicate copy of
a notice, and even if you click a button twice. Duplicates are quietly
recognized and skipped.

**Is our clients' information safe?**
Only people signed in with your firm's accounts can see your firm's notices
and cases — there's nothing for clients to log into and no public page. Like
most modern legal software, Docketly uses a carefully selected outside
reading service to help read notices; your managing attorney has the details
of that arrangement and the firm's data policies, and is the right person to
ask for specifics.

**What happens if I approve something by mistake?**
Be straightforward about it, quickly. Once you approve, any matching letters
go out within moments and can't be recalled — email is email. Open **Runs**
to see exactly what was sent and to whom, so you can follow up with the
recipient directly if needed, and let your managing attorney know. The
record will show precisely what happened, which makes the fix a phone call,
not a mystery.

**A notice has said "classifying" for a long time. Is it stuck?**
Usually it just needs a minute. Docketly also re-checks for stragglers every
few minutes on its own, so brief hiccups heal themselves. If a notice turns
red (**failed**), open it — there's a **Retry classification** button on its
page that sends it through again. If that doesn't clear it, see the next
question.

**Who do I call when something looks odd?**
Whoever administers Docketly at your firm — typically the managing attorney
or office administrator. Helpful things to tell them: which page you were
on, the case number, and what badge or message you saw. Nothing you can
click in Docketly will lose a notice, so take your time.

---

## 8. Cheat sheet — pin this above your desk

**The Docketly daily routine**

1. **Open Review.** If it says *"Nothing needs your attention."*, skip to
   step 4.
2. **For each held notice:** read the original on the left, correct only
   what's wrong on the right.
3. **Click "Approve & run automations"** — or **"Mark failed"** if it's
   junk.
4. **Glance at Notices.** Green is handled. Amber is waiting for you. Blue
   is still being read. Red — open it and click **Retry classification**.
5. **Glance at Runs.** Any red **failed** line: read the reason, fix the
   address, make sure the person was told another way.

Paper or emailed notice? **Notices → Upload PDF.** It joins the same flow.

*When in doubt: Docketly never sends anything on an unclear notice without
your approval. The queue can wait for your coffee.*
