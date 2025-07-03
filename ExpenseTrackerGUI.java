import javax.swing.*;
import java.awt.*;
import java.sql.*;

public class ExpenseTrackerGUI extends JFrame {
    static final String DB_URL = "jdbc:mysql://localhost:3306/expense_tracker";
    static final String USER = "root";
    static final String PASS = "Saadali@1";

    private JTextField descField, amountField, dateField;
    private JTextArea outputArea;

    public ExpenseTrackerGUI() {
        setTitle("Expense Tracker");
        setSize(500, 400);
        setDefaultCloseOperation(EXIT_ON_CLOSE);

        setLayout(new BorderLayout());


        JPanel inputPanel = new JPanel(new GridLayout(4, 2, 5, 5));
        inputPanel.setBorder(BorderFactory.createTitledBorder("Add New Expense"));

        descField = new JTextField();
        amountField = new JTextField();
        dateField = new JTextField();

        inputPanel.add(new JLabel("Description:"));
        inputPanel.add(descField);
        inputPanel.add(new JLabel("Amount:"));
        inputPanel.add(amountField);
        inputPanel.add(new JLabel("Date (YYYY-MM-DD):"));
        inputPanel.add(dateField);

        JButton addBtn = new JButton("Add Expense");
        addBtn.addActionListener(e -> addExpense());
        inputPanel.add(addBtn);


        JPanel buttonsPanel = new JPanel();
        JButton viewBtn = new JButton("View Expenses");
        JButton totalBtn = new JButton("Total Expenses");

        viewBtn.addActionListener(e -> viewExpenses());
        totalBtn.addActionListener(e -> totalExpenses());

        buttonsPanel.add(viewBtn);
        buttonsPanel.add(totalBtn);


        outputArea = new JTextArea();
        outputArea.setEditable(false);
        JScrollPane scrollPane = new JScrollPane(outputArea);

        add(inputPanel, BorderLayout.NORTH);
        add(buttonsPanel, BorderLayout.CENTER);
        add(scrollPane, BorderLayout.SOUTH);
    }

    private void addExpense() {
        String description = descField.getText();
        String amountStr = amountField.getText();
        String date = dateField.getText();

        if (description.isEmpty() || amountStr.isEmpty() || date.isEmpty()) {
            JOptionPane.showMessageDialog(this, "All fields are required.");
            return;
        }

        try (Connection conn = DriverManager.getConnection(DB_URL, USER, PASS)) {
            String sql = "INSERT INTO expenses (description, amount, date) VALUES (?, ?, ?)";
            PreparedStatement stmt = conn.prepareStatement(sql);
            stmt.setString(1, description);
            stmt.setDouble(2, Double.parseDouble(amountStr));
            stmt.setDate(3, Date.valueOf(date));
            stmt.executeUpdate();
            JOptionPane.showMessageDialog(this, "Expense added successfully!");
            descField.setText("");
            amountField.setText("");
            dateField.setText("");
        } catch (SQLException | IllegalArgumentException e) {
            JOptionPane.showMessageDialog(this, "Error: " + e.getMessage());
        }
    }

    private void viewExpenses() {
        outputArea.setText("ID | Description | Amount | Date\n");
        try (Connection conn = DriverManager.getConnection(DB_URL, USER, PASS)) {
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery("SELECT * FROM expenses");

            while (rs.next()) {
                outputArea.append(String.format("%d | %s | %.2f | %s\n",
                        rs.getInt("id"),
                        rs.getString("description"),
                        rs.getDouble("amount"),
                        rs.getDate("date")));
            }
        } catch (SQLException e) {
            outputArea.setText("Error: " + e.getMessage());
        }
    }

    private void totalExpenses() {
        try (Connection conn = DriverManager.getConnection(DB_URL, USER, PASS)) {
            Statement stmt = conn.createStatement();
            ResultSet rs = stmt.executeQuery("SELECT SUM(amount) AS total FROM expenses");

            if (rs.next()) {
                JOptionPane.showMessageDialog(this,
                        "Total Expenses: ₹" + String.format("%.2f", rs.getDouble("total")));
            }
        } catch (SQLException e) {
            JOptionPane.showMessageDialog(this, "Error: " + e.getMessage());
        }
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            new ExpenseTrackerGUI().setVisible(true);
        });
    }
}
