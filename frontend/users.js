async function loadUsers() {

    let users = await apiGet("/users");

    let html = "";

    users.forEach(user => {

        html += `
        <tr>
            <td>${user.user_id}</td>
            <td>${user.employee_id}</td>
            <td>${user.name}</td>
            <td>${user.role}</td>
        </tr>
        `;
    });

    document.getElementById("userTable")
            .innerHTML = html;
}

window.onload = loadUsers;
