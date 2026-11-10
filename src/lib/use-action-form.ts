"use client";
import { startTransition, type FormEvent } from "react";

/**
 * React 19 resets a <form action={fn}> after every submission, which would
 * wipe what someone typed when the server returns validation errors. This
 * submits through the action without the automatic reset, keeping the
 * clicked submit button's name/value (e.g. intent=draft|submit).
 */
export function submitWithoutReset<T>(action: (fd: FormData) => T) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => {
      action(fd);
    });
  };
}
