import { useState, useEffect } from "react";
import { adminAPI } from "@food/api";
import { Button } from "@food/components/ui/button";
import { Input } from "@food/components/ui/input";
import { Label } from "@food/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@food/components/ui/card";
import { toast } from "sonner";
import { Save, Loader2, Truck } from "lucide-react";
const debugLog = (...args) => {}
const debugWarn = (...args) => {}
const debugError = (...args) => {}

const DEFAULT_DISPATCH_SETTINGS = {
  dispatchMode: "auto",
  maxDispatchAttempts: 4,
  maxDispatchDistanceKm: 8,
  dispatchAttempts: [
    { attempt: 1, distanceKm: 2 },
    { attempt: 2, distanceKm: 4 },
    { attempt: 3, distanceKm: 6 },
    { attempt: 4, distanceKm: 8 },
  ],
};


export default function AdminSettings() {
  const [dispatchSettings, setDispatchSettings] = useState(DEFAULT_DISPATCH_SETTINGS);
  const [loadingDispatchSettings, setLoadingDispatchSettings] = useState(true);
  const [savingDispatchSettings, setSavingDispatchSettings] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadDispatchSettings = async () => {
      try {
        const response = await adminAPI.getDispatchSettings();
        const data = response?.data?.data || response?.data || {};
        if (!cancelled) {
          setDispatchSettings({
            ...DEFAULT_DISPATCH_SETTINGS,
            ...data,
            dispatchMode: "auto",
            dispatchAttempts: Array.isArray(data.dispatchAttempts) && data.dispatchAttempts.length
              ? data.dispatchAttempts
              : DEFAULT_DISPATCH_SETTINGS.dispatchAttempts,
          });
        }
      } catch (error) {
        debugWarn("Error loading dispatch settings:", error);
        if (!cancelled) toast.error("Failed to load dispatch settings");
      } finally {
        if (!cancelled) setLoadingDispatchSettings(false);
      }
    };

    loadDispatchSettings();
    return () => { cancelled = true; };
  }, []);

  const updateDispatchAttemptCount = (value) => {
    const nextCount = Math.min(20, Math.max(1, Number(value) || 1));
    setDispatchSettings((prev) => {
      const currentRows = Array.isArray(prev.dispatchAttempts) ? prev.dispatchAttempts : [];
      const dispatchAttempts = Array.from({ length: nextCount }, (_, index) => {
        const attempt = index + 1;
        const existing = currentRows.find((row) => Number(row.attempt) === attempt);
        return existing || { attempt, distanceKm: prev.maxDispatchDistanceKm || 60 };
      });

      return {
        ...prev,
        maxDispatchAttempts: nextCount,
        dispatchAttempts,
      };
    });
  };

  const updateDispatchAttemptDistance = (attempt, value) => {
    setDispatchSettings((prev) => ({
      ...prev,
      dispatchAttempts: (prev.dispatchAttempts || []).map((row) =>
        Number(row.attempt) === Number(attempt)
          ? { ...row, distanceKm: value }
          : row
      ),
    }));
  };

  const saveDispatchSettings = async () => {
    const payload = {
      dispatchMode: "auto",
      maxDispatchAttempts: Number(dispatchSettings.maxDispatchAttempts) || 1,
      maxDispatchDistanceKm: Number(dispatchSettings.maxDispatchDistanceKm) || 1,
      dispatchAttempts: (dispatchSettings.dispatchAttempts || []).map((row, index) => ({
        attempt: index + 1,
        distanceKm: Number(row.distanceKm) || 0,
      })),
    };

    try {
      setSavingDispatchSettings(true);
      const response = await adminAPI.updateDispatchSettings(payload);
      const data = response?.data?.data || response?.data || payload;
      setDispatchSettings({
        ...DEFAULT_DISPATCH_SETTINGS,
        ...data,
        dispatchMode: "auto",
        dispatchAttempts: Array.isArray(data.dispatchAttempts) && data.dispatchAttempts.length
          ? data.dispatchAttempts
          : payload.dispatchAttempts,
      });
      toast.success("Dispatch settings updated");
    } catch (error) {
      debugError("Error saving dispatch settings:", error);
      toast.error(error?.response?.data?.message || "Failed to update dispatch settings");
    } finally {
      setSavingDispatchSettings(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">Dispatch Settings</h1>
        <p className="text-neutral-600 mt-1">
          Manage delivery dispatch settings and assignment rules
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Truck className="w-5 h-5 text-neutral-700" />
            <CardTitle>Delivery Dispatch</CardTitle>
          </div>
          <CardDescription>
            Control auto-assignment attempts and rider search distance.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loadingDispatchSettings ? (
            <div className="flex items-center gap-2 text-sm text-neutral-600">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading dispatch settings...
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="dispatchMode">Dispatch Mode</Label>
                  <select
                    id="dispatchMode"
                    value="auto"
                    disabled
                    className="h-11 w-full rounded-md border border-neutral-200 bg-neutral-100 px-3 text-sm text-neutral-700 font-semibold cursor-not-allowed"
                  >
                    <option value="auto">Auto</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxDispatchAttempts">Max Attempts</Label>
                  <Input
                    id="maxDispatchAttempts"
                    type="number"
                    min="1"
                    max="20"
                    value={dispatchSettings.maxDispatchAttempts}
                    onChange={(event) => updateDispatchAttemptCount(event.target.value)}
                    disabled={savingDispatchSettings}
                    className="h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxDispatchDistanceKm">Max Distance (km)</Label>
                  <Input
                    id="maxDispatchDistanceKm"
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={dispatchSettings.maxDispatchDistanceKm}
                    onChange={(event) =>
                      setDispatchSettings((prev) => ({
                        ...prev,
                        maxDispatchDistanceKm: event.target.value,
                      }))
                    }
                    disabled={savingDispatchSettings}
                    className="h-11"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label>Attempt Distances</Label>
                <div className="grid gap-3 md:grid-cols-2">
                  {(dispatchSettings.dispatchAttempts || []).map((row) => (
                    <div
                      key={row.attempt}
                      className="flex items-center gap-3 rounded-md border border-neutral-200 p-3"
                    >
                      <div className="min-w-24 text-sm font-medium text-neutral-700">
                        Attempt {row.attempt}
                      </div>
                      <Input
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={row.distanceKm}
                        onChange={(event) =>
                          updateDispatchAttemptDistance(row.attempt, event.target.value)
                        }
                        disabled={savingDispatchSettings}
                        className="h-10"
                      />
                      <span className="text-sm text-neutral-500">km</span>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-neutral-500">
                  Resend continues to the next attempt and cannot go beyond the max attempts or max distance.
                </p>
              </div>

              <div className="flex justify-end border-t border-neutral-200 pt-4">
                <Button
                  type="button"
                  onClick={saveDispatchSettings}
                  disabled={savingDispatchSettings}
                  className="bg-black text-white hover:bg-neutral-900 h-11 px-8"
                >
                  {savingDispatchSettings ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Dispatch Settings
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
