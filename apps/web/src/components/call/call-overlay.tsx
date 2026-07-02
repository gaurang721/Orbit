'use client';

import * as React from 'react';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { useCallStore } from '@/stores/call-store';
import { Avatar } from '@/components/ui/avatar';
import { cn, fullName, initials } from '@/lib/utils';

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Round action button used for accept / decline / mute / camera / hang-up. */
function CallButton({
  onClick,
  label,
  variant,
  children,
}: {
  onClick: () => void;
  label: string;
  variant: 'accept' | 'reject' | 'neutral';
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'flex size-14 items-center justify-center rounded-full text-white shadow-lg transition active:scale-95',
        variant === 'accept' && 'bg-green-500 hover:bg-green-600',
        variant === 'reject' && 'bg-red-500 hover:bg-red-600',
        variant === 'neutral' && 'bg-white/15 hover:bg-white/25',
      )}
    >
      {children}
    </button>
  );
}

/**
 * App-wide call surface. Renders the incoming-call ringer plus the active call
 * panel — voice (avatar + timer) or video (remote video, self-view PiP) — and
 * the media sinks for the remote stream. Mounted once in Providers so a call
 * can ring/continue from any page.
 */
export function CallOverlay() {
  const status = useCallStore((s) => s.status);
  const peer = useCallStore((s) => s.peer);
  const video = useCallStore((s) => s.video);
  const muted = useCallStore((s) => s.muted);
  const cameraOff = useCallStore((s) => s.cameraOff);
  const durationSec = useCallStore((s) => s.durationSec);
  const endReason = useCallStore((s) => s.endReason);
  const remoteStream = useCallStore((s) => s.remoteStream);
  const localStream = useCallStore((s) => s.localStream);
  const acceptCall = useCallStore((s) => s.acceptCall);
  const rejectCall = useCallStore((s) => s.rejectCall);
  const hangUp = useCallStore((s) => s.hangUp);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const toggleCamera = useCallStore((s) => s.toggleCamera);

  const remoteVideoRef = React.useRef<HTMLVideoElement>(null);
  const remoteAudioRef = React.useRef<HTMLAudioElement>(null);
  const localVideoRef = React.useRef<HTMLVideoElement>(null);

  // Pipe the remote peer's media into a <video> (video calls — plays audio too)
  // or an <audio> (voice calls) once it arrives.
  React.useEffect(() => {
    const el = video ? remoteVideoRef.current : remoteAudioRef.current;
    if (el && remoteStream) {
      el.srcObject = remoteStream;
      void el.play().catch(() => {});
    }
  }, [remoteStream, video]);

  // Show our own camera in the self-view (muted to avoid local echo).
  React.useEffect(() => {
    if (video && localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      void localVideoRef.current.play().catch(() => {});
    }
  }, [localStream, video]);

  if (status === 'idle') return null;

  const name = peer ? fullName(peer) : 'Unknown';
  const incoming = status === 'incoming';
  const inCall = status === 'connecting' || status === 'active';
  const ringing = incoming || status === 'outgoing' || status === 'connecting';

  const statusText =
    status === 'outgoing'
      ? 'Calling…'
      : status === 'incoming'
        ? video
          ? 'Incoming video call'
          : 'Incoming voice call'
        : status === 'connecting'
          ? 'Connecting…'
          : status === 'active'
            ? formatDuration(durationSec)
            : (endReason ?? 'Call ended');

  // Controls shown in the active/outgoing call (not while ringing-in or ended).
  const controls = (
    <div className="flex items-center gap-5">
      {inCall && (
        <CallButton onClick={toggleMute} label={muted ? 'Unmute' : 'Mute'} variant="neutral">
          {muted ? <MicOff className="size-6" /> : <Mic className="size-6" />}
        </CallButton>
      )}
      {video && inCall && (
        <CallButton
          onClick={toggleCamera}
          label={cameraOff ? 'Turn camera on' : 'Turn camera off'}
          variant="neutral"
        >
          {cameraOff ? <VideoOff className="size-6" /> : <Video className="size-6" />}
        </CallButton>
      )}
      <CallButton onClick={hangUp} label="Hang up" variant="reject">
        <PhoneOff className="size-6" />
      </CallButton>
    </div>
  );

  // ----- Video call (connecting / active / outgoing-with-camera) -------------
  if (video && status !== 'incoming' && status !== 'ended') {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="relative flex w-[min(92vw,820px)] flex-col overflow-hidden rounded-2xl bg-neutral-900 shadow-2xl">
          {/* remote video */}
          <div className="relative aspect-video w-full bg-neutral-950">
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className={cn('h-full w-full object-cover', !remoteStream && 'hidden')}
            />
            {/* placeholder while the remote video hasn't arrived */}
            {!remoteStream && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white">
                <span className="relative">
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />
                  <Avatar
                    src={peer?.profilePicture}
                    name={name}
                    initials={peer ? initials(peer) : '?'}
                    size={88}
                    className="relative ring-4 ring-white/10"
                  />
                </span>
                <div className="text-lg font-semibold">{name}</div>
              </div>
            )}

            {/* name + timer chip */}
            <div className="absolute left-3 top-3 rounded-full bg-black/50 px-3 py-1 text-sm font-medium text-white">
              {name} · {statusText}
            </div>

            {/* self-view PiP */}
            <div className="absolute bottom-3 right-3 aspect-video w-28 overflow-hidden rounded-lg border border-white/20 bg-neutral-800 shadow-lg sm:w-40">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className={cn('h-full w-full -scale-x-100 object-cover', cameraOff && 'hidden')}
              />
              {cameraOff && (
                <div className="flex h-full w-full items-center justify-center text-white/50">
                  <VideoOff className="size-6" />
                </div>
              )}
            </div>
          </div>

          {/* controls */}
          <div className="flex items-center justify-center bg-neutral-900 py-4">{controls}</div>
        </div>
      </div>
    );
  }

  // ----- Voice call + incoming ringer (audio or video) -----------------------
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <audio ref={remoteAudioRef} autoPlay className="hidden" />
      <div className="flex w-[320px] max-w-[90vw] flex-col items-center gap-6 rounded-3xl bg-neutral-900 px-8 py-10 text-white shadow-2xl">
        <div className="relative">
          {ringing && <span className="absolute inset-0 animate-ping rounded-full bg-primary/40" />}
          <div className="relative">
            <Avatar
              src={peer?.profilePicture}
              name={name}
              initials={peer ? initials(peer) : '?'}
              size={96}
              className="ring-4 ring-white/10"
            />
          </div>
        </div>

        <div className="text-center">
          <div className="text-xl font-semibold">{name}</div>
          <div className="mt-1 text-sm text-white/70">{statusText}</div>
        </div>

        {incoming ? (
          <div className="flex items-center gap-10">
            <div className="flex flex-col items-center gap-1.5">
              <CallButton onClick={rejectCall} label="Decline" variant="reject">
                <PhoneOff className="size-6" />
              </CallButton>
              <span className="text-xs text-white/60">Decline</span>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <CallButton onClick={acceptCall} label="Accept" variant="accept">
                {video ? <Video className="size-6" /> : <Phone className="size-6" />}
              </CallButton>
              <span className="text-xs text-white/60">Accept</span>
            </div>
          </div>
        ) : (
          controls
        )}
      </div>
    </div>
  );
}
