// This file contains all common functions which are being used in multiple files

/*
    * Generating redable time string
*/
function getReadableTimestamp() {
    const now = new Date();

    const date = now.getDate().toString().padStart(2, "0"); // 01-31
    const month = now.toLocaleString("default", { month: "long" }); // January-December
    const year = now.getFullYear(); // 2025
    const hours = now.getHours().toString().padStart(2, "0"); // 00-23
    const minutes = now.getMinutes().toString().padStart(2, "0"); // 00-59
    const seconds = now.getSeconds().toString().padStart(2, "0"); // 00-59
    const ampm = hours >= 12 ? "PM" : "AM"; // AM/PM

    return `${date}-${month}-${year}_${hours}:${minutes}:${seconds}_${ampm}`;
}

/*
    * Export button logic
*/
function downloadExistingCSV(csvContent) {
    // Enable the button
    const exportButton = document.getElementById("exportButton");
    if(!exportButton) return;
    exportButton.disabled = false;

    // Add event listener to the button
    exportButton.addEventListener("click", () => {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "report.csv";
        link.style.display = "none";

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, { once: true }); // Ensures the event listener is executed only once
}