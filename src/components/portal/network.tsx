1
2
3
4
5
6
7
8
9
10
11
12
13
14
15
16
17
18
19
20
21
22
23
24
25
26
27
28
29
30
31
32
33
34
35
36
37
38
39
40
41
42
43
44
45
46
47
48
49
50
51
52
53
54
55
56
57
58
59
60
61
62
63
64
65
66
67
68
69
70
71
72
73
74
75
76
77
78
79
80
81
82
83
84
85
86
87
88
89
90
91
92
93
94
95
96
"use client";
import { useActionState, useCallback, useDeferredValue, useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { ArrowRight, Loader2, Mail, Search } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { saveNetworkCard } from "@/app/portal/actions";
import { submitWithoutReset } from "@/lib/use-action-form";
import { Field, inputClass } from "@/components/forms/field";
import { Badge } from "@/components/ui/badge";
import { ResultBanner } from "@/components/portal/profile-forms";
import { ACCOUNT_TYPE_LABEL, COMMITTEE_TYPES, EXEC_TYPES } from "@/lib/accounts";
import { InstagramMark } from "@/components/ui/social";
import { UniLogo } from "@/components/ui/uni-logo";
import { uniKey, type LogoMap } from "@/lib/university-logos";
import { instagramUrl } from "@/lib/instagram";
import { Crown, Star } from "lucide-react";
import type { AccountType } from "@/lib/types";
import { MessageButton } from "@/components/messages/message-button";
import { ManagePerson, type ManagedPerson, type ManageRights } from "@/components/admin/manage-person";

export type Delegate = {
  id: string;
  full_name: string;
  institution: string | null;
  year_of_study: string | null;
  account_type: AccountType;
  committee_position: string | null;
  bio: string | null;
  linkedin_url: string | null;
  email: string | null;
  avatar_path?: string | null;
  /** A short-lived link to their photo, added by the server. */
  avatar_url?: string | null;
  instagram?: string | null;
  /** Every role they hold. */
  roles?: AccountType[];
  /** False for people on the selected list who haven't set up an account yet. Only the committee sees these. */
  joined: boolean;
};

type CardProfile = { bio: string | null; linkedinUrl: string | null; instagram: string | null; networkShowEmail: boolean; networkListed: boolean; email: string };

export function NetworkCardForm({ profile }: { profile: CardProfile }) {
  const [state, action, pending] = useActionState(saveNetworkCard, null);
  const [bio, setBio] = useState(profile.bio ?? "");
  const fe = (k: string) => state?.fieldErrors?.[k];
  return (
    <form onSubmit={submitWithoutReset(action)} noValidate className="space-y-5">
      <ResultBanner state={state} />
      <Field id="bio" label="Short bio" error={fe("bio")} hint={`What you study, what you're working on (research, projects, societies, sport or anything else outside the course), and what you'd like to talk about on the day. ${600 - bio.length} characters left.`}>
        <textarea
          id="bio"
          name="bio"
          rows={3}
          maxLength={600}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className={inputClass}
          aria-invalid={Boolean(fe("bio"))}
          aria-describedby={fe("bio") ? "bio-error" : undefined}
        />
      </Field>
      <Field id="linkedin" label="LinkedIn profile" error={fe("linkedin")} hint="For example linkedin.com/in/your-name">
        <input
          id="linkedin"
          name="linkedin"
          type="url"
          inputMode="url"
          defaultValue={profile.linkedinUrl ?? ""}
          placeholder="https://www.linkedin.com/in/"
          className={inputClass}
          aria-invalid={Boolean(fe("linkedin"))}
          aria-describedby={fe("linkedin") ? "linkedin-error" : undefined}
        />
      </Field>
      <Field id="instagram" label="Instagram" error={fe("instagram")} hint="Your username, for example @your.name">
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate">@</span>
          <input
            id="instagram"
            name="instagram"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={profile.instagram ?? ""}
            placeholder="your.name"
            className={`${inputClass} pl-9`}
            aria-invalid={Boolean(fe("instagram"))}
            aria-describedby={fe("instagram") ? "instagram-hint instagram-error" : "instagram-hint"}
          />
        </div>
      </Field>
      <fieldset className="space-y-3">
        <legend className="sr-only">What to share</legend>
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input type="checkbox" name="showEmail" defaultChecked={profile.networkShowEmail} className="mt-0.5 size-5 shrink-0 accent-navy" />