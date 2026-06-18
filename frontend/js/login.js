async function login() {

    const employee_id = document.getElementById("emp").value;
    const password = document.getElementById("pwd").value;

    const res = await fetch("http://127.0.0.1:5000/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            employee_id,
            password
        })
    });

    const data = await res.json();

    if (data.status === "success") {

        if (data.role === "USER") {
            alert("Login successful!");
            window.location.href = "user_dashboard.html";
        }
        

        if (data.role === "MODULE_ADMIN") {
            alert("Login successful!");
            window.location.href = "admin_dashboard.html";
        }

        if (data.role === "SUPER_ADMIN") {
            alert("Login successful!");
            window.location.href = "super_admin_dashboard.html";
        }

    } else {
        alert("Invalid login");
    }
}