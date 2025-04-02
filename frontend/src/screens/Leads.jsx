import { useDispatch, useSelector } from "react-redux";
import { useEffect, useState } from "react";
import "./leads.css";
import { useNavigate } from "react-router-dom";
import { fetchAgents } from "../slices/agentsSlice";

const Leads = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const { leads } = useSelector((state) => state.leads);
  const { agents } = useSelector((state) => state.agents);

  const [statusFilter, setStatusFilter] = useState("");
  const [salesAgentFilter, setSalesAgentFilter] = useState("");

  const [sortByPriority, setSortByPriority] = useState("");
  const [sortByTimeToClose, setSortByTimeToClose] = useState("");

  const filteredLeads = leads
    .filter((lead) => {
      return (
        (!statusFilter || lead.status === statusFilter) &&
        (!salesAgentFilter || lead.salesAgent?.name === salesAgentFilter)
      );
    })

    .sort((a, b) => {
      const priorityOrder = { High: 3, Medium: 2, Low: 1 };

      // First, sort by priority if selected
      if (sortByPriority) {
        const priorityDiff =
          priorityOrder[b.priority] - priorityOrder[a.priority];

        if (sortByPriority === "High" && priorityDiff !== 0) {
          return priorityDiff; // Sort High to Low
        } else if (sortByPriority === "Low" && priorityDiff !== 0) {
          return -priorityDiff; // Sort Low to High
        }
      }

      // Then, sort by Time to Close if selected
      if (sortByTimeToClose) {
        return sortByTimeToClose === "asc"
          ? a.timeToClose - b.timeToClose
          : b.timeToClose - a.timeToClose;
      }

      return 0; // No sorting
    });

  const handleAddLead = () => {
    navigate("/add-lead");
    };
    
    useEffect(() => {
        dispatch(fetchAgents());
    }, [dispatch])

  return (
    <div>
      <h1 className="heading">Leads Overview</h1>
      <ul>
        {filteredLeads.map((lead, index) => (
          <li key={lead._id}>
            Lead: [{index + 1}] - [{lead.status}] - [{lead.salesAgent.name}] [
            {lead.priority}] [{lead.timeToClose}]
          </li>
        ))}
      </ul>
      <div className="filters">
        <h2>Filters:</h2>
        <label htmlFor="">Status:</label>
        <select
          name=""
          id=""
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {leads
            .filter(
              (lead, index, self) =>
                index === self.findIndex((t) => t.status === lead.status)
            )
            .map((lead) => (
              <option value={lead.status}>{lead.status}</option>
            ))}
        </select>
        <br />
        <br />
        <label htmlFor="">Sales Agent:</label>
        <select
          value={salesAgentFilter}
          onChange={(e) => setSalesAgentFilter(e.target.value)}
        >
          {/* {agents
            .filter(
              (lead, index, self) =>
                index ===
                self.findIndex(
                  (t) => t._id === lead.salesAgent?._id
                )
            )
            .map((lead) =>
              lead.name ? (
                <option value={agent.name}>{agent.name}</option>
              ) : null
            )} */}
          {agents?.map((agent) => (
            <option value={agent.name}>{agent.name}</option>
          ))}
        </select>
        <br />
        <br />
        <h2>Sort By:</h2>
        <label htmlFor="">Priority:</label>
        <select
          name=""
          id=""
          value={sortByPriority}
          onChange={(e) => setSortByPriority(e.target.value)}
        >
          <option value="">None</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>
        <br />
        <br />

        <label htmlFor="timeToCloseSort">Time to Close</label>
        <select
          id="timeToCloseSort"
          value={sortByTimeToClose}
          onChange={(e) => setSortByTimeToClose(e.target.value)}
        >
          <option value="">None</option>
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>
      </div>
      <button className="lead-btn" onClick={handleAddLead}>
        Add New Lead
      </button>
    </div>
  );
};

export default Leads;
