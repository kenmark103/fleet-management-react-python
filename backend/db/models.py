"""
db/models.py
Fleet Management System

Full model rewrite:
  - UUID primary keys throughout (str on Python side, uuid on DB side)
  - first_name + last_name replacing username
  - role as SQLAlchemy Enum (5 fleet roles)
  - All fleet tables: trucks, trailers, drivers, trips, fuel, maintenance
"""

import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    String, Integer, Float, Boolean, DateTime, Text,
    ForeignKey, Enum as SAEnum, func, UniqueConstraint
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from db.base import Base


# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────

def gen_uuid() -> str:
    return str(uuid.uuid4())


# ─────────────────────────────────────────────────────────────────────────────
# ENUMS  — values match frontend exactly
# ─────────────────────────────────────────────────────────────────────────────

UserRoleEnum = SAEnum(
    "ADMIN", "DISPATCHER", "DRIVER", "MECHANIC", "FINANCE",
    name="userrole"
)

TruckStatusEnum = SAEnum(
    "active", "inactive", "in-progress",
    name="truckstatus"
)

TrailerStatusEnum = SAEnum(
    "active", "inactive",
    name="trailerstatus"
)

TrailerTypeEnum = SAEnum(
    "flatbed", "refrigerated", "tanker", "box", "other",
    name="trailertype"
)

FuelTypeEnum = SAEnum(
    "diesel", "petrol", "electric", "hybrid",
    name="fueltype"
)

DriverStatusEnum = SAEnum(
    "active", "inactive",
    name="driverstatus"
)

TripStatusEnum = SAEnum(
    "pending", "en-route", "completed", "cancelled",
    name="tripstatus"
)

WorkOrderStatusEnum = SAEnum(
    "pending", "in-progress", "completed", "overdue",
    name="workorderstatus"
)

WorkOrderPriorityEnum = SAEnum(
    "low", "medium", "high", "critical",
    name="workorderpriority"
)

ServiceIntervalEnum = SAEnum(
    "km", "days", "months",
    name="serviceintervaltype"
)

VehicleDocTypeEnum = SAEnum(
    "insurance", "registration", "inspection", "other",
    name="vehicledoctype"
)

DriverDocTypeEnum = SAEnum(
    "license", "medical", "contract", "certificate", "other",
    name="driverdoctype"
)

ExpenseCategoryEnum = SAEnum(
    "fuel", "maintenance", "tolls", "tyres",
    "insurance", "licensing", "salary", "other",
    name="expensecategory"
)


# ─────────────────────────────────────────────────────────────────────────────
# USERS
# ─────────────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id:           Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    first_name:   Mapped[str] = mapped_column(String(80))
    last_name:    Mapped[str] = mapped_column(String(80))
    email:        Mapped[str] = mapped_column(String(120), unique=True, index=True)
    password:     Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    role:         Mapped[str] = mapped_column(UserRoleEnum, default="DRIVER")
    is_active:    Mapped[bool] = mapped_column(Boolean, default=True)
    is_verified:  Mapped[bool] = mapped_column(Boolean, default=False)
    phone:        Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    avatar_url:   Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    last_login_at:Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Token columns
    email_verification_token: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reset_password_token:     Mapped[Optional[str]] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    user_oauth:     Mapped[list["UserOAuth"]]    = relationship("UserOAuth", back_populates="user", cascade="all, delete-orphan")
    driver_profile: Mapped[Optional["Driver"]]   = relationship("Driver", back_populates="user", uselist=False)


class UserOAuth(Base):
    __tablename__ = "user_oauth"

    id:               Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    user_id:          Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    provider:         Mapped[str] = mapped_column(String(50), default="google")
    provider_user_id: Mapped[str] = mapped_column(String, index=True)
    provider_email:   Mapped[str] = mapped_column(String(120))
    access_token:     Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    refresh_token:    Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    expires_at:       Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at:       Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    user: Mapped[User] = relationship("User", back_populates="user_oauth")

    __table_args__ = (
        UniqueConstraint("provider", "provider_user_id", name="uq_provider_user"),
    )


class RefreshTokens(Base):
    __tablename__ = "refresh_tokens"

    id:         Mapped[str]  = mapped_column(String(36), primary_key=True, default=gen_uuid)
    token:      Mapped[str]  = mapped_column(String(500), unique=True, index=True)
    user_id:    Mapped[str]  = mapped_column(String(36), ForeignKey("users.id"))
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    is_revoked: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# FLEET — TRUCKS
# ─────────────────────────────────────────────────────────────────────────────

class Truck(Base):
    __tablename__ = "trucks"

    id:                     Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    plate_number:           Mapped[str] = mapped_column(String(20), unique=True, index=True)
    make:                   Mapped[str] = mapped_column(String(80))
    model:                  Mapped[str] = mapped_column(String(80))
    year:                   Mapped[int] = mapped_column(Integer)
    status:                 Mapped[str] = mapped_column(TruckStatusEnum, default="active")
    odometer_km:            Mapped[float] = mapped_column(Float, default=0.0)
    fuel_type:              Mapped[str] = mapped_column(FuelTypeEnum, default="diesel")
    vin:                    Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    color:                  Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    assigned_driver_id:     Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    current_trip_id:        Mapped[Optional[str]] = mapped_column(String(36), nullable=True)  # FK set after trips table
    insurance_expiry_date:  Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    inspection_expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes:                  Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at:             Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at:             Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    documents:        Mapped[list["TruckDocument"]]   = relationship("TruckDocument", back_populates="truck", cascade="all, delete-orphan")
    service_records:  Mapped[list["ServiceRecord"]]   = relationship("ServiceRecord", back_populates="truck", cascade="all, delete-orphan")
    service_schedules:Mapped[list["ServiceSchedule"]] = relationship("ServiceSchedule", back_populates="truck", cascade="all, delete-orphan")
    fuel_logs:        Mapped[list["FuelLog"]]         = relationship("FuelLog", back_populates="truck")
    work_orders:      Mapped[list["WorkOrder"]]       = relationship("WorkOrder", back_populates="truck")


class TruckDocument(Base):
    __tablename__ = "truck_documents"

    id:          Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    truck_id:    Mapped[str] = mapped_column(String(36), ForeignKey("trucks.id"))
    type:        Mapped[str] = mapped_column(VehicleDocTypeEnum)
    file_name:   Mapped[str] = mapped_column(String(255))
    file_url:    Mapped[str] = mapped_column(String(500))
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    uploaded_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))

    truck: Mapped[Truck] = relationship("Truck", back_populates="documents")


class ServiceRecord(Base):
    __tablename__ = "service_records"

    id:                  Mapped[str]   = mapped_column(String(36), primary_key=True, default=gen_uuid)
    truck_id:            Mapped[str]   = mapped_column(String(36), ForeignKey("trucks.id"))
    service_type:        Mapped[str]   = mapped_column(String(100))
    description:         Mapped[str]   = mapped_column(Text)
    odometer_at_service: Mapped[float] = mapped_column(Float)
    cost:                Mapped[float] = mapped_column(Float, default=0.0)
    performed_by:        Mapped[str]   = mapped_column(String(36), ForeignKey("users.id"))
    work_order_id:       Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("work_orders.id"), nullable=True)
    service_date:        Mapped[datetime] = mapped_column(DateTime)
    created_at:          Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    truck: Mapped[Truck] = relationship("Truck", back_populates="service_records")


# ─────────────────────────────────────────────────────────────────────────────
# FLEET — TRAILERS
# ─────────────────────────────────────────────────────────────────────────────

class Trailer(Base):
    __tablename__ = "trailers"

    id:                     Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    plate_number:           Mapped[str] = mapped_column(String(20), unique=True, index=True)
    make:                   Mapped[str] = mapped_column(String(80))
    model:                  Mapped[str] = mapped_column(String(80))
    year:                   Mapped[int] = mapped_column(Integer)
    status:                 Mapped[str] = mapped_column(TrailerStatusEnum, default="active")
    type:                   Mapped[str] = mapped_column(TrailerTypeEnum)
    capacity_tons:          Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    assigned_trip_id:       Mapped[Optional[str]]   = mapped_column(String(36), nullable=True)
    insurance_expiry_date:  Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    inspection_expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes:                  Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at:             Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at:             Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    documents: Mapped[list["TrailerDocument"]] = relationship("TrailerDocument", back_populates="trailer", cascade="all, delete-orphan")


class TrailerDocument(Base):
    __tablename__ = "trailer_documents"

    id:          Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    trailer_id:  Mapped[str] = mapped_column(String(36), ForeignKey("trailers.id"))
    type:        Mapped[str] = mapped_column(VehicleDocTypeEnum)
    file_name:   Mapped[str] = mapped_column(String(255))
    file_url:    Mapped[str] = mapped_column(String(500))
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    uploaded_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))

    trailer: Mapped[Trailer] = relationship("Trailer", back_populates="documents")


# ─────────────────────────────────────────────────────────────────────────────
# DRIVERS
# ─────────────────────────────────────────────────────────────────────────────

class Driver(Base):
    __tablename__ = "drivers"

    id:                     Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    user_id:                Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), unique=True)
    first_name:             Mapped[str] = mapped_column(String(80))
    last_name:              Mapped[str] = mapped_column(String(80))
    email:                  Mapped[str] = mapped_column(String(120))
    phone:                  Mapped[str] = mapped_column(String(30))
    status:                 Mapped[str] = mapped_column(DriverStatusEnum, default="active")
    license_number:         Mapped[str] = mapped_column(String(50), unique=True)
    license_class:          Mapped[str] = mapped_column(String(20))
    license_expiry_date:    Mapped[datetime] = mapped_column(DateTime)
    date_of_birth:          Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    national_id:            Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    address:                Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    emergency_contact_name: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    emergency_contact_phone:Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    hire_date:              Mapped[datetime] = mapped_column(DateTime)
    avatar_url:             Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    notes:                  Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at:             Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at:             Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    user:      Mapped["User"]                  = relationship("User", back_populates="driver_profile")
    documents: Mapped[list["DriverDocument"]]  = relationship("DriverDocument", back_populates="driver", cascade="all, delete-orphan")
    fuel_logs: Mapped[list["FuelLog"]]         = relationship("FuelLog", back_populates="driver")
    trips:     Mapped[list["Trip"]]            = relationship("Trip", back_populates="assigned_driver")


class DriverDocument(Base):
    __tablename__ = "driver_documents"

    id:          Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    driver_id:   Mapped[str] = mapped_column(String(36), ForeignKey("drivers.id"))
    type:        Mapped[str] = mapped_column(DriverDocTypeEnum)
    file_name:   Mapped[str] = mapped_column(String(255))
    file_url:    Mapped[str] = mapped_column(String(500))
    expiry_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    uploaded_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))

    driver: Mapped[Driver] = relationship("Driver", back_populates="documents")


# ─────────────────────────────────────────────────────────────────────────────
# TRIPS
# ─────────────────────────────────────────────────────────────────────────────

class Trip(Base):
    __tablename__ = "trips"

    id:                  Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    trip_number:         Mapped[str] = mapped_column(String(20), unique=True, index=True)  # e.g. TRP-00123
    status:              Mapped[str] = mapped_column(TripStatusEnum, default="pending")
    origin:              Mapped[str] = mapped_column(String(200))
    destination:         Mapped[str] = mapped_column(String(200))
    scheduled_departure: Mapped[datetime] = mapped_column(DateTime)
    scheduled_arrival:   Mapped[datetime] = mapped_column(DateTime)
    actual_departure:    Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    actual_arrival:      Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    distance_km:         Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cargo_description:   Mapped[Optional[str]]   = mapped_column(Text, nullable=True)
    cargo_weight_tons:   Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    assigned_truck_id:   Mapped[Optional[str]]   = mapped_column(String(36), ForeignKey("trucks.id"), nullable=True)
    assigned_trailer_id: Mapped[Optional[str]]   = mapped_column(String(36), ForeignKey("trailers.id"), nullable=True)
    assigned_driver_id:  Mapped[Optional[str]]   = mapped_column(String(36), ForeignKey("drivers.id"), nullable=True)
    dispatched_by:       Mapped[str]             = mapped_column(String(36), ForeignKey("users.id"))
    notes:               Mapped[Optional[str]]   = mapped_column(Text, nullable=True)
    created_at:          Mapped[datetime]         = mapped_column(DateTime, server_default=func.now())
    updated_at:          Mapped[datetime]         = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    assigned_driver:  Mapped[Optional["Driver"]]  = relationship("Driver", back_populates="trips")
    assigned_truck:   Mapped[Optional["Truck"]]   = relationship("Truck")
    assigned_trailer: Mapped[Optional["Trailer"]] = relationship("Trailer")


# ─────────────────────────────────────────────────────────────────────────────
# FUEL & COSTS
# ─────────────────────────────────────────────────────────────────────────────

class FuelLog(Base):
    __tablename__ = "fuel_logs"

    id:               Mapped[str]   = mapped_column(String(36), primary_key=True, default=gen_uuid)
    truck_id:         Mapped[str]   = mapped_column(String(36), ForeignKey("trucks.id"))
    driver_id:        Mapped[str]   = mapped_column(String(36), ForeignKey("drivers.id"))
    trip_id:          Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("trips.id"), nullable=True)
    litres:           Mapped[float] = mapped_column(Float)
    price_per_litre:  Mapped[float] = mapped_column(Float)
    total_cost:       Mapped[float] = mapped_column(Float)
    currency:         Mapped[str]   = mapped_column(String(3), default="USD")
    odometer_at_fuel: Mapped[float] = mapped_column(Float)
    station_name:     Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    station_location: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    receipt_url:      Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    logged_at:        Mapped[datetime] = mapped_column(DateTime)
    created_at:       Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at:       Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    truck:  Mapped[Truck]  = relationship("Truck", back_populates="fuel_logs")
    driver: Mapped[Driver] = relationship("Driver", back_populates="fuel_logs")


class Expense(Base):
    __tablename__ = "expenses"

    id:           Mapped[str]   = mapped_column(String(36), primary_key=True, default=gen_uuid)
    category:     Mapped[str]   = mapped_column(ExpenseCategoryEnum)
    amount:       Mapped[float] = mapped_column(Float)
    currency:     Mapped[str]   = mapped_column(String(3), default="USD")
    description:  Mapped[str]   = mapped_column(Text)
    truck_id:     Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("trucks.id"), nullable=True)
    driver_id:    Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("drivers.id"), nullable=True)
    trip_id:      Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("trips.id"), nullable=True)
    receipt_url:  Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    expense_date: Mapped[datetime] = mapped_column(DateTime)
    created_by:   Mapped[str]   = mapped_column(String(36), ForeignKey("users.id"))
    created_at:   Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at:   Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


# ─────────────────────────────────────────────────────────────────────────────
# MAINTENANCE
# ─────────────────────────────────────────────────────────────────────────────

class WorkOrder(Base):
    __tablename__ = "work_orders"

    id:                   Mapped[str]   = mapped_column(String(36), primary_key=True, default=gen_uuid, index=True)
    work_order_number:    Mapped[str]   = mapped_column(String(20), unique=True, index=True)  # e.g. WO-00045
    truck_id:             Mapped[str]   = mapped_column(String(36), ForeignKey("trucks.id"))
    assigned_mechanic_id: Mapped[str]   = mapped_column(String(36), ForeignKey("users.id"))
    status:               Mapped[str]   = mapped_column(WorkOrderStatusEnum, default="pending")
    priority:             Mapped[str]   = mapped_column(WorkOrderPriorityEnum, default="medium")
    title:                Mapped[str]   = mapped_column(String(200))
    description:          Mapped[str]   = mapped_column(Text)
    odometer_at_service:  Mapped[Optional[float]]    = mapped_column(Float, nullable=True)
    scheduled_date:       Mapped[datetime]            = mapped_column(DateTime)
    completed_date:       Mapped[Optional[datetime]]  = mapped_column(DateTime, nullable=True)
    estimated_cost:       Mapped[Optional[float]]     = mapped_column(Float, nullable=True)
    actual_cost:          Mapped[Optional[float]]     = mapped_column(Float, nullable=True)
    currency:             Mapped[str]   = mapped_column(String(3), default="USD")
    notes:                Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by:           Mapped[str]   = mapped_column(String(36), ForeignKey("users.id"))
    created_at:           Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at:           Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    truck:           Mapped["Truck"]                  = relationship("Truck", back_populates="work_orders")
    parts:           Mapped[list["WorkOrderPart"]]    = relationship("WorkOrderPart", back_populates="work_order", cascade="all, delete-orphan")
    service_records: Mapped[list["ServiceRecord"]]    = relationship("ServiceRecord", back_populates=None, foreign_keys="ServiceRecord.work_order_id")


class WorkOrderPart(Base):
    __tablename__ = "work_order_parts"

    id:            Mapped[str]   = mapped_column(String(36), primary_key=True, default=gen_uuid)
    work_order_id: Mapped[str]   = mapped_column(String(36), ForeignKey("work_orders.id"))
    part_name:     Mapped[str]   = mapped_column(String(120))
    part_number:   Mapped[Optional[str]] = mapped_column(String(60), nullable=True)
    quantity:      Mapped[int]   = mapped_column(Integer)
    unit_cost:     Mapped[float] = mapped_column(Float)
    total_cost:    Mapped[float] = mapped_column(Float)
    currency:      Mapped[str]   = mapped_column(String(3), default="USD")

    work_order: Mapped[WorkOrder] = relationship("WorkOrder", back_populates="parts")


class ServiceSchedule(Base):
    __tablename__ = "service_schedules"

    id:                    Mapped[str]  = mapped_column(String(36), primary_key=True, default=gen_uuid)
    truck_id:              Mapped[str]  = mapped_column(String(36), ForeignKey("trucks.id"))
    service_type:          Mapped[str]  = mapped_column(String(100))
    interval_type:         Mapped[str]  = mapped_column(ServiceIntervalEnum)
    interval_value:        Mapped[int]  = mapped_column(Integer)
    last_service_date:     Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_service_odometer: Mapped[Optional[float]]    = mapped_column(Float, nullable=True)
    next_service_date:     Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    next_service_odometer: Mapped[Optional[float]]    = mapped_column(Float, nullable=True)
    reminder_days_before:  Mapped[int]  = mapped_column(Integer, default=7)
    is_active:             Mapped[bool] = mapped_column(Boolean, default=True)
    created_by:            Mapped[str]  = mapped_column(String(36), ForeignKey("users.id"))
    created_at:            Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at:            Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    truck: Mapped[Truck] = relationship("Truck", back_populates="service_schedules")