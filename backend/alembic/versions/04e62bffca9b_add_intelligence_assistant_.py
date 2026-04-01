"""add intelligence assistant customization tables

Revision ID: 04e62bffca9b
Revises: d4850e6da140
Create Date: 2026-04-01 02:05:21.029849

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '04e62bffca9b'
down_revision: Union[str, Sequence[str], None] = 'd4850e6da140'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "vehicle_telemetry_snapshots",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("truck_id", sa.String(length=36), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("odometer_km", sa.Float(), nullable=True),
        sa.Column("engine_temp_c", sa.Float(), nullable=True),
        sa.Column("tire_pressure_avg", sa.Float(), nullable=True),
        sa.Column("battery_voltage", sa.Float(), nullable=True),
        sa.Column("fuel_rate", sa.Float(), nullable=True),
        sa.Column("speed_avg", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["truck_id"], ["trucks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_vehicle_telemetry_snapshots_truck_id"), "vehicle_telemetry_snapshots", ["truck_id"], unique=False)
    op.create_index(op.f("ix_vehicle_telemetry_snapshots_recorded_at"), "vehicle_telemetry_snapshots", ["recorded_at"], unique=False)

    op.create_table(
        "vehicle_health_scores",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("truck_id", sa.String(length=36), nullable=False),
        sa.Column("score", sa.Float(), nullable=False),
        sa.Column("risk_level", sa.String(length=20), nullable=False),
        sa.Column("predicted_issue_type", sa.String(length=120), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["truck_id"], ["trucks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_vehicle_health_scores_truck_id"), "vehicle_health_scores", ["truck_id"], unique=False)
    op.create_index(op.f("ix_vehicle_health_scores_risk_level"), "vehicle_health_scores", ["risk_level"], unique=False)
    op.create_index(op.f("ix_vehicle_health_scores_generated_at"), "vehicle_health_scores", ["generated_at"], unique=False)

    op.create_table(
        "maintenance_predictions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("truck_id", sa.String(length=36), nullable=False),
        sa.Column("source_window_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source_window_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("recommended_action", sa.String(length=255), nullable=False),
        sa.Column("due_by_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_by_odometer", sa.Float(), nullable=True),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("explanation", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["truck_id"], ["trucks.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_maintenance_predictions_truck_id"), "maintenance_predictions", ["truck_id"], unique=False)
    op.create_index(op.f("ix_maintenance_predictions_severity"), "maintenance_predictions", ["severity"], unique=False)
    op.create_index(op.f("ix_maintenance_predictions_status"), "maintenance_predictions", ["status"], unique=False)
    op.create_index(op.f("ix_maintenance_predictions_generated_at"), "maintenance_predictions", ["generated_at"], unique=False)

    op.create_table(
        "anomaly_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.String(length=36), nullable=False),
        sa.Column("metric_name", sa.String(length=100), nullable=False),
        sa.Column("observed_value", sa.Float(), nullable=True),
        sa.Column("baseline_value", sa.Float(), nullable=True),
        sa.Column("anomaly_score", sa.Float(), nullable=True),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolution_status", sa.String(length=20), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_anomaly_events_entity_type"), "anomaly_events", ["entity_type"], unique=False)
    op.create_index(op.f("ix_anomaly_events_entity_id"), "anomaly_events", ["entity_id"], unique=False)
    op.create_index(op.f("ix_anomaly_events_metric_name"), "anomaly_events", ["metric_name"], unique=False)
    op.create_index(op.f("ix_anomaly_events_severity"), "anomaly_events", ["severity"], unique=False)
    op.create_index(op.f("ix_anomaly_events_detected_at"), "anomaly_events", ["detected_at"], unique=False)
    op.create_index(op.f("ix_anomaly_events_resolution_status"), "anomaly_events", ["resolution_status"], unique=False)

    op.create_table(
        "route_plans",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("trip_id", sa.String(length=36), nullable=False),
        sa.Column("origin_lat", sa.Float(), nullable=True),
        sa.Column("origin_lng", sa.Float(), nullable=True),
        sa.Column("destination_lat", sa.Float(), nullable=True),
        sa.Column("destination_lng", sa.Float(), nullable=True),
        sa.Column("route_geometry_ref", sa.Text(), nullable=True),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("duration_secs", sa.Float(), nullable=True),
        sa.Column("eta_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("optimization_source", sa.String(length=50), nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_route_plans_trip_id"), "route_plans", ["trip_id"], unique=True)
    op.create_index(op.f("ix_route_plans_generated_at"), "route_plans", ["generated_at"], unique=False)

    op.create_table(
        "route_alternatives",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("route_plan_id", sa.String(length=36), nullable=False),
        sa.Column("label", sa.String(length=120), nullable=False),
        sa.Column("geometry_ref", sa.Text(), nullable=True),
        sa.Column("distance_km", sa.Float(), nullable=True),
        sa.Column("duration_secs", sa.Float(), nullable=True),
        sa.Column("fuel_estimate", sa.Float(), nullable=True),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["route_plan_id"], ["route_plans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_route_alternatives_route_plan_id"), "route_alternatives", ["route_plan_id"], unique=False)

    op.create_table(
        "driver_behavior_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("driver_id", sa.String(length=36), nullable=False),
        sa.Column("trip_id", sa.String(length=36), nullable=True),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("measured_value", sa.Float(), nullable=True),
        sa.Column("threshold", sa.Float(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"]),
        sa.ForeignKeyConstraint(["trip_id"], ["trips.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_driver_behavior_events_driver_id"), "driver_behavior_events", ["driver_id"], unique=False)
    op.create_index(op.f("ix_driver_behavior_events_trip_id"), "driver_behavior_events", ["trip_id"], unique=False)
    op.create_index(op.f("ix_driver_behavior_events_event_type"), "driver_behavior_events", ["event_type"], unique=False)
    op.create_index(op.f("ix_driver_behavior_events_severity"), "driver_behavior_events", ["severity"], unique=False)
    op.create_index(op.f("ix_driver_behavior_events_occurred_at"), "driver_behavior_events", ["occurred_at"], unique=False)

    op.create_table(
        "driver_scorecards",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("driver_id", sa.String(length=36), nullable=False),
        sa.Column("score_period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("score_period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("safety_score", sa.Float(), nullable=False),
        sa.Column("efficiency_score", sa.Float(), nullable=False),
        sa.Column("punctuality_score", sa.Float(), nullable=False),
        sa.Column("total_score", sa.Float(), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_driver_scorecards_driver_id"), "driver_scorecards", ["driver_id"], unique=False)
    op.create_index(op.f("ix_driver_scorecards_score_period_start"), "driver_scorecards", ["score_period_start"], unique=False)
    op.create_index(op.f("ix_driver_scorecards_score_period_end"), "driver_scorecards", ["score_period_end"], unique=False)
    op.create_index(op.f("ix_driver_scorecards_generated_at"), "driver_scorecards", ["generated_at"], unique=False)

    op.create_table(
        "coaching_recommendations",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("driver_id", sa.String(length=36), nullable=False),
        sa.Column("recommendation_type", sa.String(length=80), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("suggested_action", sa.Text(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_coaching_recommendations_driver_id"), "coaching_recommendations", ["driver_id"], unique=False)
    op.create_index(op.f("ix_coaching_recommendations_recommendation_type"), "coaching_recommendations", ["recommendation_type"], unique=False)
    op.create_index(op.f("ix_coaching_recommendations_generated_at"), "coaching_recommendations", ["generated_at"], unique=False)

    op.create_table(
        "document_ocr_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("document_type", sa.String(length=50), nullable=False),
        sa.Column("entity_type", sa.String(length=50), nullable=False),
        sa.Column("entity_id", sa.String(length=36), nullable=False),
        sa.Column("file_url", sa.String(length=500), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("processor", sa.String(length=80), nullable=True),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_document_ocr_jobs_document_type"), "document_ocr_jobs", ["document_type"], unique=False)
    op.create_index(op.f("ix_document_ocr_jobs_entity_type"), "document_ocr_jobs", ["entity_type"], unique=False)
    op.create_index(op.f("ix_document_ocr_jobs_entity_id"), "document_ocr_jobs", ["entity_id"], unique=False)
    op.create_index(op.f("ix_document_ocr_jobs_status"), "document_ocr_jobs", ["status"], unique=False)

    op.create_table(
        "extracted_document_fields",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("ocr_job_id", sa.String(length=36), nullable=False),
        sa.Column("field_name", sa.String(length=120), nullable=False),
        sa.Column("field_value", sa.Text(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ocr_job_id"], ["document_ocr_jobs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_extracted_document_fields_ocr_job_id"), "extracted_document_fields", ["ocr_job_id"], unique=False)
    op.create_index(op.f("ix_extracted_document_fields_field_name"), "extracted_document_fields", ["field_name"], unique=False)

    op.create_table(
        "document_verification_issues",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("ocr_job_id", sa.String(length=36), nullable=False),
        sa.Column("issue_type", sa.String(length=80), nullable=False),
        sa.Column("severity", sa.String(length=20), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ocr_job_id"], ["document_ocr_jobs.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_document_verification_issues_ocr_job_id"), "document_verification_issues", ["ocr_job_id"], unique=False)
    op.create_index(op.f("ix_document_verification_issues_issue_type"), "document_verification_issues", ["issue_type"], unique=False)
    op.create_index(op.f("ix_document_verification_issues_severity"), "document_verification_issues", ["severity"], unique=False)

    op.create_table(
        "knowledge_documents",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("source_type", sa.String(length=50), nullable=False),
        sa.Column("source_ref", sa.String(length=255), nullable=True),
        sa.Column("entity_type", sa.String(length=50), nullable=True),
        sa.Column("entity_id", sa.String(length=36), nullable=True),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_knowledge_documents_source_type"), "knowledge_documents", ["source_type"], unique=False)
    op.create_index(op.f("ix_knowledge_documents_entity_type"), "knowledge_documents", ["entity_type"], unique=False)
    op.create_index(op.f("ix_knowledge_documents_entity_id"), "knowledge_documents", ["entity_id"], unique=False)

    op.create_table(
        "knowledge_chunks",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("document_id", sa.String(length=36), nullable=False),
        sa.Column("chunk_text", sa.Text(), nullable=False),
        sa.Column("chunk_order", sa.Integer(), nullable=False),
        sa.Column("embedding_ref", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["knowledge_documents.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_knowledge_chunks_document_id"), "knowledge_chunks", ["document_id"], unique=False)

    op.create_table(
        "chat_sessions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("title", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_sessions_user_id"), "chat_sessions", ["user_id"], unique=False)

    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_chat_messages_session_id"), "chat_messages", ["session_id"], unique=False)
    op.create_index(op.f("ix_chat_messages_role"), "chat_messages", ["role"], unique=False)

    op.create_table(
        "assistant_action_logs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("session_id", sa.String(length=36), nullable=True),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("tool_name", sa.String(length=80), nullable=False),
        sa.Column("target_type", sa.String(length=50), nullable=True),
        sa.Column("target_id", sa.String(length=36), nullable=True),
        sa.Column("result_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["chat_sessions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_assistant_action_logs_session_id"), "assistant_action_logs", ["session_id"], unique=False)
    op.create_index(op.f("ix_assistant_action_logs_user_id"), "assistant_action_logs", ["user_id"], unique=False)
    op.create_index(op.f("ix_assistant_action_logs_tool_name"), "assistant_action_logs", ["tool_name"], unique=False)

    op.create_table(
        "dashboard_templates",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("created_by", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_dashboard_templates_name"), "dashboard_templates", ["name"], unique=True)

    op.create_table(
        "user_dashboard_preferences",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("dashboard_template_id", sa.String(length=36), nullable=True),
        sa.Column("widgets_json", sa.JSON(), nullable=False),
        sa.Column("layout_json", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["dashboard_template_id"], ["dashboard_templates.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_dashboard_preferences_user_id"), "user_dashboard_preferences", ["user_id"], unique=True)

    op.create_table(
        "saved_reports",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("report_type", sa.String(length=50), nullable=False),
        sa.Column("filters_json", sa.JSON(), nullable=False),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_saved_reports_user_id"), "saved_reports", ["user_id"], unique=False)
    op.create_index(op.f("ix_saved_reports_report_type"), "saved_reports", ["report_type"], unique=False)

    op.create_table(
        "report_widget_configs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("code", sa.String(length=80), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("config_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_report_widget_configs_code"), "report_widget_configs", ["code"], unique=True)
    op.create_index(op.f("ix_report_widget_configs_category"), "report_widget_configs", ["category"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_report_widget_configs_category"), table_name="report_widget_configs")
    op.drop_index(op.f("ix_report_widget_configs_code"), table_name="report_widget_configs")
    op.drop_table("report_widget_configs")

    op.drop_index(op.f("ix_saved_reports_report_type"), table_name="saved_reports")
    op.drop_index(op.f("ix_saved_reports_user_id"), table_name="saved_reports")
    op.drop_table("saved_reports")

    op.drop_index(op.f("ix_user_dashboard_preferences_user_id"), table_name="user_dashboard_preferences")
    op.drop_table("user_dashboard_preferences")

    op.drop_index(op.f("ix_dashboard_templates_name"), table_name="dashboard_templates")
    op.drop_table("dashboard_templates")

    op.drop_index(op.f("ix_assistant_action_logs_tool_name"), table_name="assistant_action_logs")
    op.drop_index(op.f("ix_assistant_action_logs_user_id"), table_name="assistant_action_logs")
    op.drop_index(op.f("ix_assistant_action_logs_session_id"), table_name="assistant_action_logs")
    op.drop_table("assistant_action_logs")

    op.drop_index(op.f("ix_chat_messages_role"), table_name="chat_messages")
    op.drop_index(op.f("ix_chat_messages_session_id"), table_name="chat_messages")
    op.drop_table("chat_messages")

    op.drop_index(op.f("ix_chat_sessions_user_id"), table_name="chat_sessions")
    op.drop_table("chat_sessions")

    op.drop_index(op.f("ix_knowledge_chunks_document_id"), table_name="knowledge_chunks")
    op.drop_table("knowledge_chunks")

    op.drop_index(op.f("ix_knowledge_documents_entity_id"), table_name="knowledge_documents")
    op.drop_index(op.f("ix_knowledge_documents_entity_type"), table_name="knowledge_documents")
    op.drop_index(op.f("ix_knowledge_documents_source_type"), table_name="knowledge_documents")
    op.drop_table("knowledge_documents")

    op.drop_index(op.f("ix_document_verification_issues_severity"), table_name="document_verification_issues")
    op.drop_index(op.f("ix_document_verification_issues_issue_type"), table_name="document_verification_issues")
    op.drop_index(op.f("ix_document_verification_issues_ocr_job_id"), table_name="document_verification_issues")
    op.drop_table("document_verification_issues")

    op.drop_index(op.f("ix_extracted_document_fields_field_name"), table_name="extracted_document_fields")
    op.drop_index(op.f("ix_extracted_document_fields_ocr_job_id"), table_name="extracted_document_fields")
    op.drop_table("extracted_document_fields")

    op.drop_index(op.f("ix_document_ocr_jobs_status"), table_name="document_ocr_jobs")
    op.drop_index(op.f("ix_document_ocr_jobs_entity_id"), table_name="document_ocr_jobs")
    op.drop_index(op.f("ix_document_ocr_jobs_entity_type"), table_name="document_ocr_jobs")
    op.drop_index(op.f("ix_document_ocr_jobs_document_type"), table_name="document_ocr_jobs")
    op.drop_table("document_ocr_jobs")

    op.drop_index(op.f("ix_coaching_recommendations_generated_at"), table_name="coaching_recommendations")
    op.drop_index(op.f("ix_coaching_recommendations_recommendation_type"), table_name="coaching_recommendations")
    op.drop_index(op.f("ix_coaching_recommendations_driver_id"), table_name="coaching_recommendations")
    op.drop_table("coaching_recommendations")

    op.drop_index(op.f("ix_driver_scorecards_generated_at"), table_name="driver_scorecards")
    op.drop_index(op.f("ix_driver_scorecards_score_period_end"), table_name="driver_scorecards")
    op.drop_index(op.f("ix_driver_scorecards_score_period_start"), table_name="driver_scorecards")
    op.drop_index(op.f("ix_driver_scorecards_driver_id"), table_name="driver_scorecards")
    op.drop_table("driver_scorecards")

    op.drop_index(op.f("ix_driver_behavior_events_occurred_at"), table_name="driver_behavior_events")
    op.drop_index(op.f("ix_driver_behavior_events_severity"), table_name="driver_behavior_events")
    op.drop_index(op.f("ix_driver_behavior_events_event_type"), table_name="driver_behavior_events")
    op.drop_index(op.f("ix_driver_behavior_events_trip_id"), table_name="driver_behavior_events")
    op.drop_index(op.f("ix_driver_behavior_events_driver_id"), table_name="driver_behavior_events")
    op.drop_table("driver_behavior_events")

    op.drop_index(op.f("ix_route_alternatives_route_plan_id"), table_name="route_alternatives")
    op.drop_table("route_alternatives")

    op.drop_index(op.f("ix_route_plans_generated_at"), table_name="route_plans")
    op.drop_index(op.f("ix_route_plans_trip_id"), table_name="route_plans")
    op.drop_table("route_plans")

    op.drop_index(op.f("ix_anomaly_events_resolution_status"), table_name="anomaly_events")
    op.drop_index(op.f("ix_anomaly_events_detected_at"), table_name="anomaly_events")
    op.drop_index(op.f("ix_anomaly_events_severity"), table_name="anomaly_events")
    op.drop_index(op.f("ix_anomaly_events_metric_name"), table_name="anomaly_events")
    op.drop_index(op.f("ix_anomaly_events_entity_id"), table_name="anomaly_events")
    op.drop_index(op.f("ix_anomaly_events_entity_type"), table_name="anomaly_events")
    op.drop_table("anomaly_events")

    op.drop_index(op.f("ix_maintenance_predictions_generated_at"), table_name="maintenance_predictions")
    op.drop_index(op.f("ix_maintenance_predictions_status"), table_name="maintenance_predictions")
    op.drop_index(op.f("ix_maintenance_predictions_severity"), table_name="maintenance_predictions")
    op.drop_index(op.f("ix_maintenance_predictions_truck_id"), table_name="maintenance_predictions")
    op.drop_table("maintenance_predictions")

    op.drop_index(op.f("ix_vehicle_health_scores_generated_at"), table_name="vehicle_health_scores")
    op.drop_index(op.f("ix_vehicle_health_scores_risk_level"), table_name="vehicle_health_scores")
    op.drop_index(op.f("ix_vehicle_health_scores_truck_id"), table_name="vehicle_health_scores")
    op.drop_table("vehicle_health_scores")

    op.drop_index(op.f("ix_vehicle_telemetry_snapshots_recorded_at"), table_name="vehicle_telemetry_snapshots")
    op.drop_index(op.f("ix_vehicle_telemetry_snapshots_truck_id"), table_name="vehicle_telemetry_snapshots")
    op.drop_table("vehicle_telemetry_snapshots")
