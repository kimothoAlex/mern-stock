import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 20,
    fontSize: 12,
  },
  header: {
    fontSize: 16,
    marginBottom: 10,
  },
});

const LastDaySalesReportPDF = ({ lastDaySales, totalSales }) => (
  <Document>
    <Page style={styles.page}>
      <Text style={styles.header}>Last Day Sales Report</Text>

      <Text>Total Sales: KES {totalSales.toLocaleString("en-us")}</Text>
    </Page>
  </Document>
);

export default LastDaySalesReportPDF;
