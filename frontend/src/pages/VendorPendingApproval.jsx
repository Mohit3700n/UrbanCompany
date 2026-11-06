
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

function VendorPendingApproval() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const response = await api.get("/vendors/me");
        const vendorStatus = response.data.status;

        setStatus(vendorStatus);

        if (vendorStatus === "approved") {
          navigate("/vendor-dashboard", { replace: true });
        }
      } catch (err) {
        setError(
          err.response?.data?.detail ||
          "Unable to check your application status."
        );
        setStatus("error");
      }
    };

    checkStatus();
  }, [navigate]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#f6f9f6",
      padding: 20
    }}>
      <div style={{
        maxWidth: 480,
        width: "100%",
        background: "white",
        padding: 35,
        borderRadius: 16,
        textAlign: "center",
        border: "1px solid #e4ebe5"
      }}>
        <div style={{ fontSize: 48, marginBottom: 15 }}>
          {status === "pending" ? "◷" : status === "rejected" ? "!" : "✓"}
        </div>

        <h1 style={{ color: "#19372a", fontSize: 25 }}>
          {status === "loading"
            ? "Checking application..."
            : status === "pending"
            ? "Application under review"
            : status === "rejected"
            ? "Application rejected"
            : "Unable to check status"}
        </h1>

        <p style={{
          color: "#78877d",
          fontSize: 14,
          lineHeight: 1.8,
          marginTop: 15
        }}>
          {status === "pending"
            ? "Your vendor profile has been submitted successfully. Our admin team will review your application. You cannot receive service requests until approval."
            : status === "rejected"
            ? "Your application was not approved. Please contact the DailyDrill support team for more information."
            : status === "error"
            ? error
            : "Please wait while we check your vendor application."}
        </p>

        {status === "pending" && (
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 25,
              padding: "12px 20px",
              background: "#174b35",
              color: "white",
              border: 0,
              borderRadius: 8,
              cursor: "pointer"
            }}
          >
            Refresh application status
          </button>
        )}

        {status === "error" && (
          <button
            onClick={() => navigate("/login")}
            style={{
              marginTop: 25,
              padding: "12px 20px",
              background: "#174b35",
              color: "white",
              border: 0,
              borderRadius: 8,
              cursor: "pointer"
            }}
          >
            Go to login
          </button>
        )}
      </div>
    </div>
  );
}

export default VendorPendingApproval;
