import { useState, useEffect, useCallback, useRef } from 'react';
import { checkForUpdate, type UpdateInfo } from '@/lib/updater';

let startupCheckStarted = false;

export function useUpdate() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState(false);
  const mountedRef = useRef(true);

  const checkUpdate = useCallback(async () => {
    setChecking(true);
    setUpdateError(null);
    try {
      const result = await checkForUpdate({ timeout: 30000 });
      if (!mountedRef.current) return null;

      if (result.status === 'available') {
        setUpdateInfo(result.info);
        setChecked(true);
        return result.info;
      }

      setUpdateInfo(null);
      setChecked(true);
      return null;
    } catch (error) {
      if (mountedRef.current) {
        setUpdateInfo(null);
        setUpdateError(String(error));
        setChecked(true);
      }
      return null;
    } finally {
      if (mountedRef.current) setChecking(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!startupCheckStarted) {
      startupCheckStarted = true;
      checkUpdate();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [checkUpdate]);

  return {
    updateInfo,
    updateError,
    hasUpdate: !!updateInfo,
    checking,
    checked,
    checkUpdate,
  };
}
