from pymongo import MongoClient
import os

client = MongoClient(os.getenv('MONGO_URI'))
db = client.aihr_database

users_collection = db.users
companies_collection = db.companies
company_profile_collection = db.company_profiles
vacancies_collection = db.vacancies
interviews_collection = db.interviews
interview_answers_collection = db.interview_answers
status_history_collection = db.status_history
