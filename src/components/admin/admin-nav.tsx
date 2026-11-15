129
130
131
132
133
134
135
136
137
138
139
140
141
142
143
144
145
146
147
148
149
150
151
152
153
154
155
156
157
158
159
160
161
162
163
164
165
166
167
168
169
170
171
172
173
174
175
176
177
178
179
180
181
182
183
184
185
186
187
188
189
190
191
192
193
194
195
196
197
198
199
200
201
202
203
204
205
206
207
208
209
210
211
212
213
214
215
216
217
218
219
220
221
222
223
224
225
226
227
228
229
230
231
232
233
234
235
236
237
238
239
240
241
242
243
244
245
246
247
248
249
250
251
252
253
254
255
256
          <span className="icon-chip-sm bg-navy text-gold-300">
            <CurrentIcon aria-hidden className="size-4" />
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block font-ui text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-slate">Committee dashboard</span>
            <span className="block truncate font-semibold text-ink">{currentLink?.label ?? "Overview"}</span>
          </span>
          {waiting > 0 && (
            <span className="grid min-w-5 place-items-center rounded-full bg-coral px-1.5 text-[0.7rem] font-bold leading-5 text-white">
              {waiting}
              <span className="sr-only"> enquiries waiting</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-paper-200 px-3 py-1.5 font-ui text-xs font-semibold text-ink">
            <LayoutGrid aria-hidden className="size-3.5" /> Menu
          </span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-[70] lg:hidden" role="dialog" aria-modal="true" aria-label="Committee dashboard menu" id="admin-sheet">
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="sheet-fade absolute inset-0 bg-midnight/55 backdrop-blur-[2px]" />
          <nav aria-label="Committee dashboard" className="sheet-up absolute inset-x-0 bottom-0 flex max-h-[88dvh] flex-col rounded-t-[28px] bg-paper shadow-[var(--shadow-sheet)]">
            <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-2">
              <span aria-hidden className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-navy/15" />
              <span className="mt-4 grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 font-ui text-sm font-bold text-midnight">{initials(name)}</span>
              <span className="mt-4 min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{name}</span>
                <span className="block truncate text-xs text-slate">{position}</span>
              </span>
              <button type="button" onClick={() => setOpen(false)} className="tap mt-4 grid size-10 place-items-center rounded-full bg-white ring-1 ring-navy/10" aria-label="Close menu">
                <X aria-hidden className="size-5" />
              </button>
            </div>
            <div className="overflow-y-auto overscroll-contain px-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
              {groups.map((g, gi) => (
                <div key={g.title} className="mb-4">
                  <p className="mb-2 px-1 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate">{g.title}</p>
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {g.links.map((l, i) => {
                      const active = l.href === current;
                      return (
                        <li key={l.href} className="pop-in" style={{ animationDelay: `${gi * 40 + i * 25}ms` }}>
                          <Link
                            href={l.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "tap flex min-h-14 items-center gap-2.5 rounded-2xl p-2.5 text-[0.8rem] font-semibold leading-tight",
                              active ? "bg-navy text-paper" : "bg-white text-ink ring-1 ring-navy/[0.07]",
                            )}
                          >
                            <span className={cn("icon-chip-sm", active ? "bg-white/10 text-gold-300" : TONES[(gi + i) % TONES.length])}>
                              <l.icon aria-hidden className="size-4" />
                            </span>
                            <span className="min-w-0 flex-1">{l.label}</span>
                            {badge(l, active)}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 border-t border-navy/10 pt-4">
                <Link href="/portal" className="tap flex min-h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-ink ring-1 ring-navy/10">
                  <UserRound aria-hidden className="size-4" /> My Hub
                </Link>
                <Link href="/" className="tap flex min-h-12 items-center justify-center gap-2 rounded-full bg-white text-sm font-semibold text-ink ring-1 ring-navy/10">
                  <Eye aria-hidden className="size-4" /> Website
                </Link>
              </div>
            </div>
          </nav>
        </div>
      )}

      {/* Wide screens: the full menu in a sticky side column. */}
      <nav aria-label="Committee dashboard" className="hidden min-w-0 lg:sticky lg:top-24 lg:block lg:max-h-[calc(100vh-7rem)] lg:self-start lg:overflow-y-auto lg:pb-6">
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-midnight p-3 text-paper">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-gold-300 to-gold-600 font-ui text-sm font-bold text-midnight">{initials(name)}</span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold">{name}</span>
            <span className="block truncate text-xs text-paper/65">{position}</span>
          </span>
        </div>
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.title}>
              <p className="mb-1 px-3 font-ui text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate">{g.title}</p>
              <ul className="flex flex-col gap-0.5">
                {g.links.map((l) => {
                  const active = l.href === current;
                  return (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "tap flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium",
                          active ? "bg-navy text-paper shadow-[0_6px_16px_-8px_rgba(12,24,44,0.7)]" : "text-slate-700 hover:bg-white hover:text-ink",
                        )}
                      >
                        <l.icon aria-hidden className={cn("size-4", active ? "text-gold-300" : "text-electric-600")} /> {l.label}
                        {badge(l, active)}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <div className="border-t border-navy/10 pt-4">
            <Link href="/portal" className="tap flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-white">
              <UserRound aria-hidden className="size-4" /> My Hub
            </Link>
            <Link href="/" className="tap flex min-h-10 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-white">
              <Eye aria-hidden className="size-4" /> View the website
            </Link>
          </div>
        </div>
      </nav>
    </>
  );
}

const TONES = ["tone-navy", "tone-teal", "tone-sky", "tone-plum", "tone-coral", "tone-gold", "tone-rose"];

function initials(name: string) {