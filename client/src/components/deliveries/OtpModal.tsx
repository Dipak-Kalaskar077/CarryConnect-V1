import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

interface OtpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (otp: string) => Promise<void>;
  title: string;
  description: string;
  isLoading?: boolean;
}

const OtpModal = ({ 
  open, 
  onOpenChange, 
  onSubmit, 
  title, 
  description,
  isLoading = false 
}: OtpModalProps) => {
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (otp.length !== 6) {
      setError("OTP must be exactly 6 digits");
      return;
    }

    if (!/^\d+$/.test(otp)) {
      setError("OTP must contain only numbers");
      return;
    }

    setError("");
    try {
      await onSubmit(otp);
      setOtp("");
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Invalid OTP. Please try again.");
    }
  };

  const handleClose = () => {
    setOtp("");
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <label htmlFor="otp-input" className="block text-sm font-medium text-gray-700 mb-2">
              Enter 6-Digit OTP
            </label>
            <Input
              id="otp-input"
              type="text"
              placeholder="000000"
              value={otp}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setOtp(value);
                setError("");
              }}
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === "Enter" && otp.length === 6) {
                  handleSubmit();
                }
              }}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || otp.length !== 6}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OtpModal;

