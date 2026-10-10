"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DAYS_LONG,
  DAYS_SHORT,
  MAX_DATES,
  formatDay,
  generateDates,
  isLastWeekOfMonth,
  monthChoiceLabels,
  parseDay,
  patternText,
  summaryText,
  type MonthMode,
  type RepeatFreq,
  type RepeatRule,
} from "@/lib/event-repeat";
import { looksLikeEmail } from "@/lib/event-view";
import { EVENT_UPGRADE_PRICE } from "@/lib/pricing";
import type { WPEventOrganizerProfile, WPEventVenue, WPScEventCategory, WPScEventTag } from "@/lib/wordpress";
import { ClockIcon, PinIcon, RepeatIcon } from "./EvIcons";
import { FeatureEventPay } from "./FeatureEventPay";

/** "£5 per event" → "£5" */
const FEATURE_PRICE = EVENT_UPGRADE_PRICE.split(" ")[0];

export interface EventFormInitial {
  title: string;
  description: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** "HH:MM" */
  startTime: string;
  endTime: string;
  /** Every start date ("YYYY-MM-DD") of a repeating event; empty for a one-off. */
  repeatDates: string[];
  venue_name: string;
  venue_address: string;
  /** Legacy free-text organiser name, for events that predate organiser profiles. */
  organizer: string;
  organizer_id: string;
  area: string;
  /** Category (topic tag) slugs — as many as the member likes. */
  topics: string[];
  /** Tags not offered as categories (e.g. the old "Free Entry"), kept as they are. */
  otherTags: string[];
  price_type: string;
  price_amount: string;
  price_from: boolean;
  price_concession: string;
  booking_type: string;
  booking_link_kind: string;
  booking_email: string;
  booking_phone: string;
  event_url: string;
  image: string;
}

const NEW_VENUE = "__new__";
const NEW_ORG = "__new__";
const SELF_ORG = "__self__";
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_UPLOAD = 5 * 1024 * 1024;
const DAYS3 = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/**
 * Photos are shrunk in the browser before upload (longest side 2000px,
 * logos 800px): Vercel refuses request bodies over ~4.5MB, so a 5MB photo
 * would otherwise fail, and nobody needs more than this on a web page.
 */
async function shrinkImage(file: File, maxSide: number): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 3.5 * 1024 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.86));
    return blob ?? file;
  } catch {
    return file;
  }
}

function t12(t: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return "";
  const h = +m[1];
  return `${h % 12 || 12}${m[2] === "00" ? "" : `:${m[2]}`} ${h >= 12 ? "pm" : "am"}`;
}

function Msg({ kind, children }: { kind: "warn" | "err" | "ok"; children: ReactNode }) {
  return <div className={`evf-msg evf-msg-${kind}`}>{children}</div>;
}

/**
 * The "Add your event" form (events redesign, Stage 4), shared by
 * /events/submit (create) and /events/[slug]/edit (update). Layout as the
 * mockup's Submit form tab: sections separated by thin lines inside one
 * white panel, with a live "Preview in the events list" card and the
 * Submit button in the right-hand column on desktop (after the form on
 * mobile). `header` is whatever goes at the top of the white panel.
 */
export function EventForm({
  mode,
  eventId,
  eventSlug,
  header,
  areas,
  topics,
  venues,
  organizers,
  memberName,
  initial,
  sideExtra,
}: {
  mode: "create" | "edit";
  eventId?: number;
  eventSlug?: string;
  header?: ReactNode;
  areas: WPScEventCategory[];
  topics: WPScEventTag[];
  venues: WPEventVenue[];
  /** Organisers this member manages (plus the event's own, when editing). */
  organizers: WPEventOrganizerProfile[];
  memberName: string;
  initial?: EventFormInitial;
  /** Extra card under Submit in the right-hand column (the edit page's "Feature this event"). */
  sideExtra?: ReactNode;
}) {
  const router = useRouter();

  // ---- The event
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [chosenTopics, setChosenTopics] = useState<string[]>(initial?.topics ?? []);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>(initial?.image ?? "");
  const [imageMeta, setImageMeta] = useState<{ name: string; w: number; h: number; size: number } | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // ---- When
  const initialRepeat = (initial?.repeatDates?.length ?? 0) > 1;
  const [date, setDate] = useState(initial?.date ?? "");
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  const [repeats, setRepeats] = useState(initialRepeat);
  const [rule, setRule] = useState<Omit<RepeatRule, "start">>({
    // Editing a repeating event opens on its existing dates, picked by hand.
    freq: initialRepeat ? "custom" : "weekly",
    every: 1,
    weekdays: [],
    monthMode: "date",
    ends: "count",
    count: 6,
    until: "",
    custom: initialRepeat ? initial!.repeatDates.slice(1) : [],
  });
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [customPick, setCustomPick] = useState("");

  // ---- Where
  const initialKnownVenue = Boolean(initial?.venue_name && venues.some((v) => v.name === initial.venue_name));
  const [addingVenue, setAddingVenue] = useState(Boolean(initial?.venue_name) && !initialKnownVenue);
  const [venueName, setVenueName] = useState(initial?.venue_name ?? "");
  const [venueAddress, setVenueAddress] = useState(initial?.venue_address ?? "");
  const [area, setArea] = useState(initial?.area ?? "");

  // ---- Organiser
  const legacyOnly = Boolean(initial?.organizer) && !initial?.organizer_id;
  const [orgChoice, setOrgChoice] = useState(legacyOnly ? NEW_ORG : initial?.organizer_id ?? "");
  const [editingOrg, setEditingOrg] = useState(false);
  const [org, setOrg] = useState({
    name: legacyOnly ? initial!.organizer : "",
    about: "",
    email: "",
    phone: "",
    url: "",
    address: "",
    facebook: "",
    instagram: "",
    x: "",
    tiktok: "",
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");

  // ---- Price and booking
  const [priceType, setPriceType] = useState(initial?.price_type || "unknown");
  const [priceAmount, setPriceAmount] = useState(initial?.price_amount ?? "");
  const [priceFrom, setPriceFrom] = useState(initial?.price_from ?? false);
  const [concession, setConcession] = useState(initial?.price_concession ?? "");
  const [booking, setBooking] = useState(
    initial?.booking_type === "contact" || initial?.booking_type === "none" ? initial.booking_type : "online"
  );
  const [eventUrl, setEventUrl] = useState(initial?.event_url ?? "");
  const [linkKind, setLinkKind] = useState(initial?.booking_link_kind || (initial?.event_url ? "website" : "tickets"));
  const [bookingEmail, setBookingEmail] = useState(initial?.booking_email ?? "");
  const [bookingPhone, setBookingPhone] = useState(initial?.booking_phone ?? "");

  // ---- Submit
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: number; slug: string; dates: number; imageError?: string } | null>(null);

  const selectedOrg = organizers.find((o) => String(o.id) === orgChoice) ?? null;
  const showOrgFields = orgChoice === NEW_ORG || orgChoice === SELF_ORG || (Boolean(selectedOrg) && editingOrg);

  const fullRule: RepeatRule = { ...rule, start: date };
  const ruleKey = JSON.stringify(fullRule);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dates = useMemo(() => (repeats ? generateDates(fullRule) : []), [repeats, ruleKey]);
  const liveDates = dates.filter((d) => !skipped.has(d));
  const monthLabels = monthChoiceLabels(date);
  const lastWeek = isLastWeekOfMonth(date);

  useEffect(() => {
    if (!lastWeek && rule.monthMode === "last") setRule((r) => ({ ...r, monthMode: "nth" }));
  }, [lastWeek, rule.monthMode]);

  useEffect(() => {
    if (!imageFile) return;
    const url = URL.createObjectURL(imageFile);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  function pickImage(file: File | undefined) {
    if (!file) return;
    setImageError(null);
    if (!IMAGE_TYPES.includes(file.type)) {
      setImageError("That file type isn't supported. Please use a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > MAX_UPLOAD) {
      setImageError(`That image is ${(file.size / 1048576).toFixed(1)}MB. Please use one under 5MB.`);
      return;
    }
    const probeUrl = URL.createObjectURL(file);
    const probe = new Image();
    probe.onload = () => {
      setImageMeta({ name: file.name, w: probe.naturalWidth, h: probe.naturalHeight, size: file.size });
      URL.revokeObjectURL(probeUrl);
    };
    probe.src = probeUrl;
    setImageFile(file);
  }

  function pickLogo(file: File | undefined) {
    if (!file || !IMAGE_TYPES.includes(file.type) || file.size > MAX_UPLOAD) return;
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  }

  function chooseOrganizer(value: string) {
    setOrgChoice(value);
    setEditingOrg(false);
    if (value === SELF_ORG) setOrg((o) => ({ ...o, name: memberName }));
    else if (value === NEW_ORG) setOrg((o) => ({ ...o, name: "" }));
  }

  function startEditingOrg() {
    if (!selectedOrg) return;
    setOrg({
      name: selectedOrg.name,
      about: selectedOrg.about ?? "",
      email: selectedOrg.email ?? "",
      phone: selectedOrg.phone ?? "",
      url: selectedOrg.url ?? "",
      address: selectedOrg.address ?? "",
      facebook: selectedOrg.facebook ?? "",
      instagram: selectedOrg.instagram ?? "",
      x: selectedOrg.x ?? "",
      tiktok: selectedOrg.tiktok ?? "",
    });
    setEditingOrg(true);
  }

  function chooseVenue(value: string) {
    if (value === NEW_VENUE) {
      setAddingVenue(true);
      setVenueName("");
      setVenueAddress("");
      return;
    }
    setAddingVenue(false);
    setVenueName(value);
    setVenueAddress(venues.find((v) => v.name === value)?.address ?? "");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!date || !startTime) {
      setError("Please add the date and start time.");
      return;
    }
    if (repeats && liveDates.length < 2) {
      setError("A repeating event needs at least two dates. Untick “This event repeats” if it's a one-off.");
      return;
    }
    if (showOrgFields && looksLikeEmail(org.url)) {
      setError("The organiser's website looks like an email address. Please put it in the Public email box instead.");
      return;
    }
    if (booking === "online" && looksLikeEmail(eventUrl)) {
      setError("The event link looks like an email address. Please choose “Contact to book” and put it there instead.");
      return;
    }

    const at = (day: string) => `${day}T${startTime}`;
    // With repeats on, the first date ticked is the event's main date; the
    // end time applies to it and every other date gets the same length.
    const firstDay = repeats && liveDates[0] ? liveDates[0] : date;
    const data: Record<string, unknown> = {
      title,
      description,
      start: at(firstDay),
      end: endTime ? `${firstDay}T${endTime}` : "",
      venue_name: venueName,
      venue_address: venueAddress,
      category: area,
      tags: [...chosenTopics, ...(initial?.otherTags ?? [])],
      price_type: priceType,
      price_amount: priceType === "paid" ? priceAmount : "",
      price_from: priceType === "paid" && priceFrom,
      price_concession: priceType === "paid" ? concession : "",
      booking_type: booking === "online" ? "link" : booking,
      event_url: booking === "online" ? eventUrl : "",
      booking_link_kind: booking === "online" ? linkKind : "",
      booking_email: booking === "contact" ? bookingEmail : "",
      booking_phone: booking === "contact" ? bookingPhone : "",
      repeat_dates: repeats ? liveDates.map(at) : [],
      repeat_pattern: repeats ? patternText(fullRule) : "",
    };

    // Organiser — see SC_Events_REST::set_organizer_from_request: an
    // organizer_id attaches (or, with organizer_edit, also updates) that
    // organiser; its absence plus organizer_name creates a new one.
    const orgFields = {
      organizer_name: org.name,
      organizer_about: org.about,
      organizer_email: org.email,
      organizer_phone: org.phone,
      organizer_url: org.url,
      organizer_address: org.address,
      organizer_facebook: org.facebook,
      organizer_instagram: org.instagram,
      organizer_x: org.x,
      organizer_tiktok: org.tiktok,
    };
    if (orgChoice === NEW_ORG || orgChoice === SELF_ORG) Object.assign(data, orgFields);
    else if (selectedOrg) {
      data.organizer_id = String(selectedOrg.id);
      if (editingOrg) Object.assign(data, orgFields, { organizer_edit: true });
    } else data.organizer_id = "";

    setSubmitting(true);
    const res = await fetch(mode === "create" ? "/api/events/submit" : `/api/events/${eventId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Something went wrong — please try again.");
      setSubmitting(false);
      return;
    }
    const id: number = body.id ?? eventId;
    const slug: string = body.slug ?? eventSlug ?? "";

    // Photo and logo go up after the event exists (multipart, owner-checked).
    let uploadError: string | undefined;
    const sendLogo = Boolean(logoFile) && showOrgFields;
    if (imageFile || sendLogo) {
      const upload = new FormData();
      if (imageFile) upload.append("image", await shrinkImage(imageFile, 2000), imageFile.name);
      if (logoFile && sendLogo) upload.append("logo", await shrinkImage(logoFile, 800), logoFile.name);
      const up = await fetch(`/api/events/${id}/images`, { method: "POST", body: upload });
      if (!up.ok) {
        const upBody = await up.json().catch(() => ({}));
        uploadError = upBody.error || "The image didn't upload.";
      }
    }

    if (mode === "edit" && !uploadError) {
      router.push(`/events/${slug}`);
      router.refresh();
      return;
    }
    setSubmitting(false);
    setDone({ id, slug, dates: repeats ? liveDates.length : 1, imageError: uploadError });
  }

  // ---- Preview card, as it will look in the events list
  const previewFirst = parseDay(repeats ? liveDates[0] ?? date : date);
  const previewFlag = repeats && liveDates.length > 1 ? patternText(fullRule).split(",")[0] : null;
  const previewTime = startTime ? t12(startTime) + (endTime ? ` – ${t12(endTime)}` : "") : "";

  const imageNote =
    imageError ? (
      <Msg kind="err">{imageError}</Msg>
    ) : imageMeta ? (
      imageMeta.h > imageMeta.w ? (
        <Msg kind="warn">This image is portrait. It will be cropped to landscape in listings, so check nothing important is cut off.</Msg>
      ) : imageMeta.w < 1200 ? (
        <Msg kind="warn">This image is quite small ({imageMeta.w}px wide), so it may look blurry. 1200px wide or more is best.</Msg>
      ) : (
        <Msg kind="ok">Looks good.</Msg>
      )
    ) : null;

  return (
    <form className="evx-layout evf-layout" onSubmit={handleSubmit}>
      <div className="evf-main">
        {header}
        {mode === "create" && <h2 className="evf-divider">New event</h2>}

        {/* 1. The event */}
        <section className="evf-sec">
          <h2>The event</h2>
          <div className="evf-fields">
            <div className="evf-field">
              <label className="evf-lab" htmlFor="ev-title">
                Event title
              </label>
              <input id="ev-title" type="text" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="evf-field">
              <label className="evf-lab" htmlFor="ev-desc">
                Description
              </label>
              <textarea id="ev-desc" rows={5} value={description} onChange={(e) => setDescription(e.target.value)} />
              <span className="evf-hint">Price and booking have their own boxes below.</span>
            </div>
            <div className="evf-field">
              <span className="evf-lab">Event image</span>
              <div
                className={`evf-drop${dragOver ? " evf-drop-over" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  pickImage(e.dataTransfer.files[0]);
                }}
              >
                {imageUrl ? (
                  <div className="evf-drop-prev">
                    <img src={imageUrl} alt="Your event image" />
                    <div className="evf-drop-meta">
                      {imageMeta ? (
                        <>
                          <b>{imageMeta.name}</b>
                          {imageMeta.w} × {imageMeta.h} px · {(imageMeta.size / 1048576).toFixed(1)} MB
                        </>
                      ) : (
                        <b>Current image</b>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="evf-drop-empty">
                    <span className="evf-drop-ic" aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="16" rx="2" />
                        <circle cx="9" cy="10" r="2" />
                        <path d="M21 16l-5-5-8 9" />
                      </svg>
                    </span>
                    <div>
                      <b>Drop an image here or choose a file</b>
                      <small>JPG, PNG or WebP, up to 5MB</small>
                    </div>
                  </div>
                )}
                {imageNote}
                <div className="evf-inline">
                  <label className="evx-btn evx-btn-sm evf-file-btn">
                    {imageUrl ? "Choose another image" : "Choose image"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => {
                        pickImage(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {imageFile && (
                    <button
                      type="button"
                      className="evx-btn evx-btn-sm"
                      onClick={() => {
                        setImageFile(null);
                        setImageMeta(null);
                        setImageUrl(initial?.image ?? "");
                      }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <span className="evf-hint">
                Remember text in an image can&apos;t be read on phones or found in searches, so make sure the details are
                in the description too. Perhaps consider sharing a photo instead? Only use images you have permission to
                share.
              </span>
            </div>
            {topics.length > 0 && (
              <fieldset className="evf-field evf-fieldset">
                <legend className="evf-lab">
                  Categories <span className="evf-opt">(tick as many as you like)</span>
                </legend>
                <div className="evf-tags">
                  {topics.map((t) => (
                    <label key={t.id} className="evf-tag">
                      <input
                        type="checkbox"
                        checked={chosenTopics.includes(t.slug)}
                        onChange={(e) =>
                          setChosenTopics((cur) =>
                            e.target.checked ? [...cur, t.slug] : cur.filter((x) => x !== t.slug)
                          )
                        }
                      />
                      <span>{t.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        </section>

        {/* 2. When */}
        <section className="evf-sec">
          <h2>When</h2>
          <p className="evf-lead">For repeating events, enter the first date.</p>
          <div className="evf-fields">
            <div className="evf-row evf-row-3">
              <div className="evf-field">
                <label className="evf-lab" htmlFor="ev-date">
                  Date
                </label>
                <input id="ev-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="evf-field">
                <label className="evf-lab" htmlFor="ev-start">
                  Starts
                </label>
                <input id="ev-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
              </div>
              <div className="evf-field">
                <label className="evf-lab" htmlFor="ev-end">
                  Ends <span className="evf-opt">(optional)</span>
                </label>
                <input id="ev-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </div>
            <label className="evf-toggle">
              <input type="checkbox" checked={repeats} onChange={(e) => setRepeats(e.target.checked)} />
              <span className="evf-sw" aria-hidden="true" />
              This event repeats
            </label>
            {repeats && (
              <div className="evf-sub">
                <div className="evf-field">
                  <span className="evf-lab">How often?</span>
                  <div className="evf-inline">
                    <span>Every</span>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={rule.every}
                      disabled={rule.freq === "custom"}
                      aria-label="Interval"
                      onChange={(e) => setRule((r) => ({ ...r, every: Number(e.target.value) || 1 }))}
                    />
                    <select
                      aria-label="Frequency"
                      value={rule.freq}
                      onChange={(e) => setRule((r) => ({ ...r, freq: e.target.value as RepeatFreq }))}
                    >
                      <option value="daily">day(s)</option>
                      <option value="weekly">week(s)</option>
                      <option value="monthly">month(s)</option>
                      <option value="custom">pick dates by hand</option>
                    </select>
                  </div>
                </div>
                {rule.freq === "weekly" && (
                  <div className="evf-field">
                    <span className="evf-lab">On these days</span>
                    <div className="evf-days">
                      {DAYS_SHORT.map((d, i) => (
                        <label key={d} className="evf-day">
                          <input
                            type="checkbox"
                            aria-label={DAYS_LONG[i]}
                            checked={rule.weekdays.includes(i)}
                            onChange={(e) =>
                              setRule((r) => ({
                                ...r,
                                weekdays: e.target.checked ? [...r.weekdays, i] : r.weekdays.filter((x) => x !== i),
                              }))
                            }
                          />
                          <span>{["Tue", "Thu", "Sat", "Sun"].includes(d) ? d.slice(0, 2) : d.slice(0, 1)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {rule.freq === "monthly" && (
                  <div className="evf-field">
                    <span className="evf-lab">On</span>
                    <div className="evf-choices">
                      {(["date", "nth", "last"] as MonthMode[])
                        .filter((m) => m !== "last" || lastWeek)
                        .map((m) => (
                          <label key={m} className="evf-choice">
                            <input
                              type="radio"
                              name="ev-mm"
                              checked={rule.monthMode === m}
                              onChange={() => setRule((r) => ({ ...r, monthMode: m }))}
                            />
                            <span>
                              <b>{monthLabels[m]}</b>
                            </span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
                {rule.freq !== "custom" ? (
                  <div className="evf-field">
                    <span className="evf-lab">Ends</span>
                    <div className="evf-choices">
                      <label className="evf-choice">
                        <input
                          type="radio"
                          name="ev-ends"
                          checked={rule.ends === "count"}
                          onChange={() => setRule((r) => ({ ...r, ends: "count" }))}
                        />
                        <span className="evf-inline">
                          <b>After</b>
                          <input
                            type="number"
                            min={2}
                            max={MAX_DATES}
                            value={rule.count}
                            aria-label="Number of dates"
                            onChange={(e) => setRule((r) => ({ ...r, ends: "count", count: Number(e.target.value) || 2 }))}
                          />
                          <b>dates</b>
                        </span>
                      </label>
                      <label className="evf-choice">
                        <input
                          type="radio"
                          name="ev-ends"
                          checked={rule.ends === "until"}
                          onChange={() => setRule((r) => ({ ...r, ends: "until" }))}
                        />
                        <span className="evf-inline">
                          <b>On</b>
                          <input
                            type="date"
                            value={rule.until}
                            aria-label="End date"
                            onChange={(e) => setRule((r) => ({ ...r, ends: "until", until: e.target.value }))}
                          />
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="evf-field">
                    <span className="evf-lab">Add a date</span>
                    <div className="evf-inline">
                      <input type="date" value={customPick} aria-label="Date to add" onChange={(e) => setCustomPick(e.target.value)} />
                      <button
                        type="button"
                        className="evx-btn evx-btn-sm"
                        onClick={() => {
                          if (customPick && !rule.custom.includes(customPick)) {
                            setRule((r) => ({ ...r, custom: [...r.custom, customPick] }));
                          }
                          setCustomPick("");
                        }}
                      >
                        Add date
                      </button>
                    </div>
                  </div>
                )}
                <div className="evf-summary">
                  <RepeatIcon />
                  <span>{summaryText(fullRule, liveDates, t12(startTime))}</span>
                </div>
                <div className="evf-field">
                  <span className="evf-lab">Dates this will create</span>
                  {dates.length > 0 ? (
                    <ul className="evf-gen">
                      {dates.map((d, i) => {
                        const day = parseDay(d)!;
                        const removable = rule.freq === "custom" && i > 0;
                        return (
                          <li key={d}>
                            <label className={skipped.has(d) ? "evf-gen-off" : undefined}>
                              <input
                                type="checkbox"
                                checked={!skipped.has(d)}
                                onChange={(e) =>
                                  setSkipped((s) => {
                                    const next = new Set(s);
                                    if (e.target.checked) next.delete(d);
                                    else next.add(d);
                                    return next;
                                  })
                                }
                              />
                              {formatDay(day)}
                              {removable && (
                                <button
                                  type="button"
                                  className="evf-gen-x"
                                  aria-label={`Remove ${formatDay(day)}`}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setRule((r) => ({ ...r, custom: r.custom.filter((c) => c !== d) }));
                                  }}
                                >
                                  ×
                                </button>
                              )}
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <span className="evf-hint">Pick at least one date.</span>
                  )}
                  {dates.length > 0 && (
                    <span className="evf-hint">
                      {dates.length} dates
                      {skipped.size ? `, ${dates.filter((d) => skipped.has(d)).length} skipped` : ""}
                      {dates.length >= MAX_DATES ? ` (${MAX_DATES} is the most)` : ""}. Untick any dates that are cancelled.
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 3. Where */}
        <section className="evf-sec">
          <h2>Where</h2>
          <div className="evf-fields">
            <div className="evf-row">
              <div className="evf-field">
                <label className="evf-lab" htmlFor="ev-venue">
                  Venue
                </label>
                <select id="ev-venue" value={addingVenue ? NEW_VENUE : venueName} onChange={(e) => chooseVenue(e.target.value)}>
                  <option value="">Select a venue…</option>
                  {venues.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name}
                    </option>
                  ))}
                  <option value={NEW_VENUE}>+ Add a new location</option>
                </select>
              </div>
              {addingVenue && (
                <div className="evf-field">
                  <label className="evf-lab" htmlFor="ev-vnew">
                    New venue name
                  </label>
                  <input id="ev-vnew" type="text" value={venueName} placeholder="Venue name" onChange={(e) => setVenueName(e.target.value)} />
                </div>
              )}
            </div>
            <div className="evf-field">
              <label className="evf-lab" htmlFor="ev-vaddr">
                Venue address
              </label>
              <input id="ev-vaddr" type="text" value={venueAddress} onChange={(e) => setVenueAddress(e.target.value)} />
            </div>
            {areas.length > 0 && (
              <div className="evf-row">
                <div className="evf-field">
                  <label className="evf-lab" htmlFor="ev-area">
                    Area
                  </label>
                  <select id="ev-area" value={area} onChange={(e) => setArea(e.target.value)}>
                    <option value="">Select an area…</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.slug}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 4. Organiser */}
        <section className="evf-sec">
          <h2>Organiser</h2>
          <p className="evf-lead">The group running the event.</p>
          <div className="evf-fields">
            <div className="evf-field">
              <label className="evf-lab" htmlFor="ev-org">
                Organiser
              </label>
              <select id="ev-org" value={orgChoice} onChange={(e) => chooseOrganizer(e.target.value)}>
                <option value="">Choose…</option>
                {organizers.length > 0 && (
                  <optgroup label="Organisers you manage">
                    {organizers.map((o) => (
                      <option key={o.id} value={String(o.id)}>
                        {o.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                <option value={SELF_ORG}>I&apos;m organising this myself</option>
                <option value={NEW_ORG}>+ Add a new organiser</option>
              </select>
              <span className="evf-hint">
                Who&apos;s running this event — a business or group, not a personal name. Picking an existing organiser
                links this event to every other event they&apos;ve run.
              </span>
            </div>
            {selectedOrg && !editingOrg && (
              <div className="evf-org-summary">
                <span className="evf-org-t">
                  <b>{selectedOrg.name}</b>
                  {[selectedOrg.email, selectedOrg.phone, selectedOrg.url].filter(Boolean).join(" · ") || "No contact details yet"}
                </span>
                <button type="button" className="evx-btn evx-btn-sm" onClick={startEditingOrg}>
                  Edit details
                </button>
              </div>
            )}
            {showOrgFields && (
              <div className="evf-sub">
                <div className="evf-public-note">
                  {orgChoice === SELF_ORG
                    ? "Organising it yourself? Give it a public name, like “Jane’s Yoga Classes”, and add the contact details you’re happy to share. They appear on this organiser’s own page. Your member profile stays separate."
                    : "These details are public. They appear on the organiser’s own page, which every event they run links to. Your member account and profile stay separate."}
                </div>
                <div className="evf-field">
                  <label className="evf-lab" htmlFor="ev-oname">
                    Organiser name
                  </label>
                  <input
                    id="ev-oname"
                    type="text"
                    value={org.name}
                    placeholder="e.g. Carshalton Rotary Club"
                    onChange={(e) => setOrg({ ...org, name: e.target.value })}
                    required
                  />
                </div>
                <div className="evf-field">
                  <label className="evf-lab" htmlFor="ev-oabout">
                    About <span className="evf-opt">(optional)</span>
                  </label>
                  <textarea
                    id="ev-oabout"
                    rows={3}
                    maxLength={400}
                    value={org.about}
                    placeholder="A couple of sentences about the group and what it does"
                    onChange={(e) => setOrg({ ...org, about: e.target.value })}
                  />
                  <span className="evf-counter">{org.about.length} / 400</span>
                </div>
                <div className="evf-field">
                  <span className="evf-lab">
                    Logo <span className="evf-opt">(optional)</span>
                  </span>
                  <div className="evf-inline">
                    <span
                      className="evf-logo"
                      style={
                        logoPreview || selectedOrg?.logo_url
                          ? { backgroundImage: `url(${logoPreview || selectedOrg?.logo_url})` }
                          : undefined
                      }
                      aria-hidden="true"
                    />
                    <label className="evx-btn evx-btn-sm evf-file-btn">
                      Choose logo
                      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => pickLogo(e.target.files?.[0])} />
                    </label>
                    <span className="evf-hint">Square works best.</span>
                  </div>
                </div>
                <div className="evf-row">
                  <div className="evf-field">
                    <label className="evf-lab" htmlFor="ev-oemail">
                      Public email
                    </label>
                    <input id="ev-oemail" type="email" value={org.email} onChange={(e) => setOrg({ ...org, email: e.target.value })} />
                  </div>
                  <div className="evf-field">
                    <label className="evf-lab" htmlFor="ev-ophone">
                      Organiser phone
                    </label>
                    <input id="ev-ophone" type="tel" value={org.phone} onChange={(e) => setOrg({ ...org, phone: e.target.value })} />
                  </div>
                </div>
                <div className="evf-field">
                  <label className="evf-lab" htmlFor="ev-ourl">
                    Organiser website
                  </label>
                  <input id="ev-ourl" type="url" value={org.url} placeholder="https://" onChange={(e) => setOrg({ ...org, url: e.target.value })} />
                  {looksLikeEmail(org.url) && (
                    <Msg kind="err">That looks like an email address. Please put it in the Public email box instead.</Msg>
                  )}
                </div>
                <div className="evf-field">
                  <label className="evf-lab" htmlFor="ev-oaddr">
                    Organiser address <span className="evf-opt">(optional)</span>
                  </label>
                  <input id="ev-oaddr" type="text" value={org.address} onChange={(e) => setOrg({ ...org, address: e.target.value })} />
                </div>
                <div className="evf-field">
                  <span className="evf-lab">
                    Social links <span className="evf-opt">(optional)</span>
                  </span>
                  <div className="evf-row">
                    <input type="url" value={org.facebook} placeholder="Facebook page link" aria-label="Facebook" onChange={(e) => setOrg({ ...org, facebook: e.target.value })} />
                    <input type="url" value={org.instagram} placeholder="Instagram link" aria-label="Instagram" onChange={(e) => setOrg({ ...org, instagram: e.target.value })} />
                    <input type="url" value={org.x} placeholder="X link" aria-label="X" onChange={(e) => setOrg({ ...org, x: e.target.value })} />
                    <input type="url" value={org.tiktok} placeholder="TikTok link" aria-label="TikTok" onChange={(e) => setOrg({ ...org, tiktok: e.target.value })} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 5. Price and booking */}
        <section className="evf-sec">
          <h2>Price and booking</h2>
          <div className="evf-fields">
            <div className="evf-field">
              <span className="evf-lab">Price</span>
              <div className="evf-choices evf-c3">
                {[
                  ["free", "Free"],
                  ["paid", "Paid"],
                  ["unknown", "Not sure"],
                ].map(([v, l]) => (
                  <label key={v} className="evf-choice">
                    <input type="radio" name="ev-price" checked={priceType === v} onChange={() => setPriceType(v)} />
                    <span>
                      <b>{l}</b>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {priceType === "paid" && (
              <div className="evf-sub">
                <div className="evf-row">
                  <div className="evf-field">
                    <label className="evf-lab" htmlFor="ev-amt">
                      Price
                    </label>
                    <div className="evf-money">
                      <span>£</span>
                      <input id="ev-amt" type="number" min={0} step={0.5} placeholder="7" value={priceAmount} onChange={(e) => setPriceAmount(e.target.value)} />
                    </div>
                    <label className="evf-check">
                      <input type="checkbox" checked={priceFrom} onChange={(e) => setPriceFrom(e.target.checked)} />
                      Prices start from this amount
                    </label>
                  </div>
                  <div className="evf-field">
                    <label className="evf-lab" htmlFor="ev-conc">
                      Concessions <span className="evf-opt">(optional)</span>
                    </label>
                    <input id="ev-conc" type="text" placeholder="e.g. £6 members, under-16s free" value={concession} onChange={(e) => setConcession(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
            <div className="evf-field">
              <span className="evf-lab">How do people book?</span>
              <div className="evf-choices evf-c3">
                {[
                  ["online", "Online", "Link to tickets or a website"],
                  ["contact", "Contact to book", "By email or phone"],
                  ["none", "No booking needed", "Just turn up"],
                ].map(([v, l, s]) => (
                  <label key={v} className="evf-choice">
                    <input type="radio" name="ev-book" checked={booking === v} onChange={() => setBooking(v)} />
                    <span>
                      <b>{l}</b>
                      <small>{s}</small>
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {booking === "online" && (
              <div className="evf-sub">
                <div className="evf-field">
                  <label className="evf-lab" htmlFor="ev-url">
                    Event-specific link
                  </label>
                  <input id="ev-url" type="url" placeholder="https://" value={eventUrl} onChange={(e) => setEventUrl(e.target.value)} />
                  {looksLikeEmail(eventUrl) && (
                    <Msg kind="err">That looks like an email address. Choose &ldquo;Contact to book&rdquo; above and put it there instead.</Msg>
                  )}
                  <span className="evf-hint">
                    Please link to the booking or ticket page if there is one, or the event&apos;s own website. Add your
                    group&apos;s own details under Organiser above.
                  </span>
                </div>
                <div className="evf-field">
                  <span className="evf-lab">Where does this link go?</span>
                  <div className="evf-choices evf-c2">
                    {[
                      ["tickets", "Ticket page"],
                      ["website", "Website"],
                    ].map(([v, l]) => (
                      <label key={v} className="evf-choice">
                        <input type="radio" name="ev-lk" checked={linkKind === v} onChange={() => setLinkKind(v)} />
                        <span>
                          <b>{l}</b>
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {booking === "contact" && (
              <div className="evf-sub">
                <div className="evf-hint">Leave blank to use the organiser&apos;s details.</div>
                <div className="evf-row">
                  <div className="evf-field">
                    <label className="evf-lab" htmlFor="ev-bemail">
                      Booking email
                    </label>
                    <input id="ev-bemail" type="email" value={bookingEmail} onChange={(e) => setBookingEmail(e.target.value)} />
                  </div>
                  <div className="evf-field">
                    <label className="evf-lab" htmlFor="ev-bphone">
                      Booking phone
                    </label>
                    <input id="ev-bphone" type="tel" value={bookingPhone} onChange={(e) => setBookingPhone(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      <aside className="evx-side evf-side">
        <section className="evx-card-dk evf-preview">
          <p className="evx-eyebrow">Preview in the events list</p>
          <div className="evx-card evx-card-dark evf-pv">
            <div className="evx-card-img">
              {imageUrl ? <img src={imageUrl} alt="" /> : <div className="evx-card-noimg evf-pv-noimg">Your image</div>}
              {previewFlag && (
                <span className="evx-badge-repeat">
                  <RepeatIcon />
                  {previewFlag}
                </span>
              )}
            </div>
            <div className="evx-card-body">
              {previewFirst && (
                <div className="evx-date evx-date-sm" aria-hidden="true">
                  <span className="evx-date-w">{DAYS3[(previewFirst.getUTCDay() + 6) % 7]}</span>
                  <b>{previewFirst.getUTCDate()}</b>
                  <span className="evx-date-m">{MONS[previewFirst.getUTCMonth()]}</span>
                </div>
              )}
              <div className="evx-card-txt">
                <h3>{title.trim() || "Your event title"}</h3>
                {(previewTime || venueName) && (
                  <div className="evx-card-meta">
                    {previewTime && (
                      <span>
                        <ClockIcon />
                        {previewTime}
                      </span>
                    )}
                    {venueName && (
                      <span>
                        <PinIcon />
                        {venueName}
                      </span>
                    )}
                  </div>
                )}
                {previewFlag && <div className="evx-card-next">+{liveDates.length - 1} more dates</div>}
              </div>
            </div>
          </div>
          <p className="evf-note">Updates as you type.</p>
        </section>
        <section className="evf-submit">
          <p>{mode === "create" ? "Your event goes live straight away." : "Changes show on the site straight away."}</p>
          {error && <Msg kind="err">{error}</Msg>}
          <button type="submit" className="evx-btn-primary" disabled={submitting}>
            {submitting ? "Saving…" : mode === "create" ? "Submit event" : "Save changes"}
          </button>
        </section>
        {sideExtra}
      </aside>

      {done && (
        <div className="evf-modal-wrap">
          <div className="evf-modal" role="dialog" aria-modal="true" aria-labelledby="evf-modal-title">
            <div className="evf-tick" aria-hidden="true">
              ✓
            </div>
            <h2 id="evf-modal-title">{mode === "create" ? "Your event is live" : "Your changes are saved"}</h2>
            <p>
              {title.trim() || "Your event"}
              {done.dates > 1 ? ` is now on Secret Carshalton with all ${done.dates} dates.` : " is now on Secret Carshalton."} You
              can edit it any time from your dashboard.
            </p>
            {done.imageError && (
              <Msg kind="warn">The image didn&apos;t upload ({done.imageError}). You can add it from the event&apos;s edit page.</Msg>
            )}
            {mode === "create" && done.dates === 1 ? (
              <>
                <div className="evf-upgrade">
                  <h3>Get more people to see it</h3>
                  <p>
                    Your event goes to the top of the events list and into the rotating highlight on the homepage, until
                    the event date.
                  </p>
                  <div className="evf-cost">
                    {FEATURE_PRICE} <span>one-off payment</span>
                  </div>
                  <FeatureEventPay eventId={done.id} />
                  <button type="button" className="evx-btn" onClick={() => router.push(`/events/${done.slug}`)}>
                    No thanks
                  </button>
                </div>
                <p className="evf-later">You can also do this later from your dashboard or the event&apos;s edit page.</p>
              </>
            ) : (
              <div className="evf-row-btns">
                <Link className="evx-btn evf-btn-ink" href={`/events/${done.slug}`}>
                  View your event
                </Link>
                {mode === "create" && (
                  <button type="button" className="evx-btn" onClick={() => window.location.reload()}>
                    Add another event
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </form>
  );
}
