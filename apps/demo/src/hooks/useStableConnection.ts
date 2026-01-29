'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useReconnect } from 'wagmi';

/**
 * MetaMask 일시적 연결 끊김에 강건한 연결 상태 훅
 *
 * MetaMask의 Service Worker가 일시적으로 연결이 끊어지면
 * contentscript가 1초 후 재연결을 시도합니다.
 * 이 훅은 연결 끊김 후 grace period 동안 기다려서
 * 일시적 끊김과 실제 끊김을 구분합니다.
 *
 * @param gracePeriodMs - 연결 끊김 후 대기 시간 (기본: 2000ms)
 */
export function useStableConnection(gracePeriodMs = 2000) {
  const { isConnected: rawIsConnected, ...rest } = useAccount();
  const { reconnect, connectors } = useReconnect();

  // 안정적인 연결 상태 (grace period 적용)
  const [stableIsConnected, setStableIsConnected] = useState(rawIsConnected);

  // 이전 연결 상태 추적
  const wasConnected = useRef(false);
  const disconnectTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 연결됨: 즉시 상태 업데이트하고 타이머 취소
    if (rawIsConnected) {
      wasConnected.current = true;
      if (disconnectTimer.current) {
        clearTimeout(disconnectTimer.current);
        disconnectTimer.current = null;
      }
      setStableIsConnected(true);
      return;
    }

    // 연결 끊김: 이전에 연결되어 있었으면 grace period 적용
    if (!rawIsConnected && wasConnected.current) {
      // 재연결 시도
      if (connectors.length > 0) {
        setTimeout(() => {
          reconnect({ connectors });
        }, 1500);
      }

      // grace period 후에도 연결 안 되면 실제 끊김으로 처리
      disconnectTimer.current = setTimeout(() => {
        setStableIsConnected(false);
        wasConnected.current = false;
      }, gracePeriodMs);

      return () => {
        if (disconnectTimer.current) {
          clearTimeout(disconnectTimer.current);
        }
      };
    }

    // 처음부터 연결 안 됨
    if (!rawIsConnected && !wasConnected.current) {
      setStableIsConnected(false);
    }
  }, [rawIsConnected, reconnect, connectors, gracePeriodMs]);

  return {
    isConnected: stableIsConnected,
    rawIsConnected,
    ...rest,
  };
}
