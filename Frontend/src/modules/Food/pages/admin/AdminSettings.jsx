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
            maxDispatchAttempts: 4,
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
    // Max attempts is fixed at 4
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
    const maxDist = Number(dispatchSettings.maxDispatchDistanceKm) || 0;
    if (maxDist <= 0) {
      toast.error("Max Distance must be greater than 0");
      return;
    }

    const attempts = dispatchSettings.dispatchAttempts || [];
    for (const row of attempts) {
      const dist = Number(row.distanceKm) || 0;
      if (dist <= 0) {
        toast.error(`Attempt ${row.attempt} distance must be greater than 0`);
        return;
      }
      if (dist > maxDist) {
        toast.error(`Attempt ${row.attempt} distance (${dist} km) cannot be greater than Max Distance (${maxDist} km)`);
        return;
      }
    }

    const payload = {
      dispatchMode: "auto",
      maxDispatchAttempts: 4,
      maxDispatchDistanceKm: maxDist,
      dispatchAttempts: attempts.map((row, index) => ({
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
        maxDispatchAttempts: 4,
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
                    className="h-11 w-full rounded-md border border-neutral-200 bg-neutral-100 px-3 text-sm text-neutral-700 font-semibold cursor-not-allowed appearance-none"
                  >
                    <option value="auto">Auto</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxDispatchAttempts">Max Attempts</Label>
                  <Input
                    id="maxDispatchAttempts"
                    type="number"
                    value={4}
                    disabled
                    readOnly
                    className="h-11 bg-neutral-100 text-neutral-700 font-semibold cursor-not-allowed"
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
                  {(dispatchSettings.dispatchAttempts || []).map((row) => {
                    const isExceeding = Number(row.distanceKm) > Number(dispatchSettings.maxDispatchDistanceKm);
                    return (
                      <div key={row.attempt} className="space-y-1">
                        <div
                          className={`flex items-center gap-3 rounded-md border p-3 ${
                            isExceeding ? "border-red-500 bg-red-50/30" : "border-neutral-200"
                          }`}
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
                            className={`h-10 ${isExceeding ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                          />
                          <span className="text-sm text-neutral-500">km</span>
                        </div>
                        {isExceeding && (
                          <p className="text-[11px] text-red-500 font-medium ml-1">
                            Cannot exceed Max Distance ({dispatchSettings.maxDispatchDistanceKm || 0} km)
                          </p>
                        )}
                      </div>
                    );
                  })}
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
