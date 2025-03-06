/*  
    * Building Front data to display CSV
*/
const displayCSV = (csvHTML) => {
    const table = document.getElementById('csvTable');
    table.innerHTML = csvHTML;

    document.getElementById("skeletonLoader").style.display = "none";
    table.style.display = "block";
}

/*
    * Export button logic
*/
function downloadExistingCSV(csvContent) {
    // Enable the button
    const exportButton = document.getElementById("exportButton");
    if (!exportButton) return;
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

/*  
    * Form Submission is being handled
    * All form values are being fetched
*/
const handleSubmit = async (e) => {
    e.preventDefault();
    document.getElementById("emptyState").style.display = "none";
    document.getElementById("csvTable").style.display = "none";
    document.getElementById("skeletonLoader").style.display = "block";
    const formData = new FormData(e.target);
    const startDate = formData.get("start_date");
    const endDate = formData.get("end_date");

    const { createdCSV, frontHTML } = await fetch('/getUtilizationCSV', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ startDate, endDate }),
    }).then(res => res.json());
    displayCSV(frontHTML);
    downloadExistingCSV(createdCSV);
}